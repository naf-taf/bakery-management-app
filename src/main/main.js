const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let db;
let securityHeadersConfigured = false;

const rendererCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws://localhost:5173 http://localhost:5173",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

const sessionDataPath = path.join(app.getPath('userData'), 'session-data');
if (!fs.existsSync(sessionDataPath)) {
  fs.mkdirSync(sessionDataPath, { recursive: true });
}
app.setPath('sessionData', sessionDataPath);

function setupSecurityHeaders() {
  if (securityHeadersConfigured) {
    return;
  }

  const session = mainWindow.webContents.session;

  session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    responseHeaders['Content-Security-Policy'] = [rendererCsp];
    callback({ responseHeaders });
  });

  securityHeadersConfigured = true;
}

function getRendererEntry() {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;

  if (!app.isPackaged && devServerUrl) {
    return { type: 'url', value: devServerUrl };
  }

  return {
    type: 'file',
    value: path.join(__dirname, '../renderer/build/index.html'),
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(__dirname, 'assets', 'bakery-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  setupSecurityHeaders();

  const rendererEntry = getRendererEntry();

  if (rendererEntry.type === 'url') {
    mainWindow.loadURL(rendererEntry.value);
  } else {
    mainWindow.loadFile(rendererEntry.value);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeDatabase() {
  // Initialize database - use app user data directory for packaged app
  const dbDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'db')
    : path.join(__dirname, '../../db');

  // Ensure db directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'bakery.db');

  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

  await createTables();
}

app.whenReady().then(async () => {
  try {
    await initializeDatabase();
    createWindow();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for database operations
ipcMain.handle('db-query', async (event, query, params) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('Database not initialized');
      return reject(new Error('Database not initialized'));
    }
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('db-run', async (event, query, params) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('Database not initialized');
      return reject(new Error('Database not initialized'));
    }
    db.run(query, params, function (err) {
      if (err) {
        console.error('Run error:', err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('recipe-delete', async (event, recipeId) => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    await runStatement('BEGIN IMMEDIATE TRANSACTION');
    await runStatement(
      'DELETE FROM kneading_batches WHERE plan_id IN (SELECT id FROM baking_plans WHERE recipe_id = ?)',
      [recipeId],
    );
    await runStatement('DELETE FROM baking_plans WHERE recipe_id = ?', [recipeId]);
    await runStatement('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
    const result = await runStatement('DELETE FROM recipes WHERE id = ?', [recipeId]);
    await runStatement('COMMIT');
    return result;
  } catch (error) {
    try {
      await runStatement('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed after recipe delete error:', rollbackError);
    }

    console.error('Recipe delete transaction failed:', error);
    throw error;
  }
});

function runStatement(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function readRows(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

async function addColumnIfNotExists(table, columnName, columnDefinition) {
  const rows = await readRows(`PRAGMA table_info(${table})`);
  const exists = rows.some((row) => row.name === columnName);

  if (!exists) {
    await runStatement(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}`);
  }
}

async function normalizeDuplicateNames(table) {
  const rows = await readRows(`SELECT id, name FROM ${table} ORDER BY id`);
  const usedNames = new Set();

  for (const row of rows) {
    const originalName = typeof row.name === 'string' ? row.name : '';
    const baseName = originalName.trim() || `${table}-${row.id}`;
    let candidateName = baseName;
    let suffix = 2;

    while (usedNames.has(candidateName.toLowerCase())) {
      candidateName = `${baseName} (${suffix})`;
      suffix += 1;
    }

    if (candidateName !== row.name) {
      await runStatement(`UPDATE ${table} SET name = ? WHERE id = ?`, [candidateName, row.id]);
    }

    usedNames.add(candidateName.toLowerCase());
  }
}

async function createTables() {
  await runStatement('PRAGMA foreign_keys = ON');

  await runStatement(`CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      cost_per_unit REAL DEFAULT 0
    )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      yield_quantity INTEGER DEFAULT 1,
      yield_unit TEXT DEFAULT 'шт'
    )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      UNIQUE(recipe_id, ingredient_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS baking_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      recipe_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'planned',
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(date, recipe_id)
    )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS kneading_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      batch_time TEXT,
      notes TEXT,
      FOREIGN KEY (plan_id) REFERENCES baking_plans(id) ON DELETE CASCADE
    )`);

  await addColumnIfNotExists('recipes', 'yield_quantity', 'yield_quantity INTEGER DEFAULT 1');
  await addColumnIfNotExists('recipes', 'yield_unit', "yield_unit TEXT DEFAULT 'шт'");
  await addColumnIfNotExists('recipe_ingredients', 'recipe_id', 'recipe_id INTEGER');
  await addColumnIfNotExists('recipe_ingredients', 'ingredient_id', 'ingredient_id INTEGER');
  await addColumnIfNotExists('recipe_ingredients', 'quantity', 'quantity REAL NOT NULL DEFAULT 0');
  await addColumnIfNotExists('baking_plans', 'status', "status TEXT DEFAULT 'planned'");

  await runStatement('BEGIN IMMEDIATE TRANSACTION');

  try {
    await normalizeDuplicateNames('ingredients');
    await normalizeDuplicateNames('recipes');

    await runStatement(`DELETE FROM kneading_batches
      WHERE plan_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM baking_plans WHERE baking_plans.id = kneading_batches.plan_id)`);
    await runStatement(`DELETE FROM baking_plans
      WHERE recipe_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM recipes WHERE recipes.id = baking_plans.recipe_id)`);
    await runStatement(`UPDATE baking_plans
      SET quantity = (
        SELECT SUM(other.quantity)
        FROM baking_plans other
        WHERE other.date = baking_plans.date
          AND other.recipe_id = baking_plans.recipe_id
      )
      WHERE EXISTS (
        SELECT 1
        FROM baking_plans other
        WHERE other.date = baking_plans.date
          AND other.recipe_id = baking_plans.recipe_id
          AND other.id <> baking_plans.id
      )`);
    await runStatement(`UPDATE kneading_batches
      SET plan_id = (
        SELECT MIN(plan.id)
        FROM baking_plans plan
        JOIN baking_plans current_plan
          ON current_plan.date = plan.date
         AND current_plan.recipe_id = plan.recipe_id
        WHERE current_plan.id = kneading_batches.plan_id
      )
      WHERE EXISTS (
        SELECT 1
        FROM baking_plans duplicate_plan
        JOIN baking_plans current_plan
          ON current_plan.date = duplicate_plan.date
         AND current_plan.recipe_id = duplicate_plan.recipe_id
        WHERE current_plan.id = kneading_batches.plan_id
          AND duplicate_plan.id <> current_plan.id
      )`);
    await runStatement(`DELETE FROM baking_plans
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM baking_plans
        GROUP BY date, recipe_id
      )`);
    await runStatement(`DELETE FROM recipe_ingredients
      WHERE recipe_id IS NULL
         OR ingredient_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_ingredients.recipe_id)
         OR NOT EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = recipe_ingredients.ingredient_id)`);
    await runStatement(`UPDATE recipe_ingredients
      SET quantity = (
        SELECT SUM(other.quantity)
        FROM recipe_ingredients other
        WHERE other.recipe_id = recipe_ingredients.recipe_id
          AND other.ingredient_id = recipe_ingredients.ingredient_id
      )
      WHERE EXISTS (
        SELECT 1
        FROM recipe_ingredients other
        WHERE other.recipe_id = recipe_ingredients.recipe_id
          AND other.ingredient_id = recipe_ingredients.ingredient_id
          AND other.id <> recipe_ingredients.id
      )`);
    await runStatement(`DELETE FROM recipe_ingredients
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM recipe_ingredients
        GROUP BY recipe_id, ingredient_id
      )`);
    await runStatement(`CREATE UNIQUE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_ingredient_id_unique
      ON recipe_ingredients(recipe_id, ingredient_id)`);
    await runStatement(`CREATE UNIQUE INDEX IF NOT EXISTS baking_plans_date_recipe_id_unique
      ON baking_plans(date, recipe_id)`);
    await runStatement(
      `CREATE UNIQUE INDEX IF NOT EXISTS ingredients_name_unique ON ingredients(name)`,
    );
    await runStatement(`CREATE UNIQUE INDEX IF NOT EXISTS recipes_name_unique ON recipes(name)`);
    await runStatement('COMMIT');
  } catch (error) {
    try {
      await runStatement('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed during database initialization:', rollbackError);
    }

    throw error;
  }
}
