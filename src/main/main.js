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
      unit TEXT NOT NULL CHECK(unit IN ('гр', 'кг')),
      cost_per_unit REAL DEFAULT 0
    )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      yield_quantity INTEGER DEFAULT 1,
      yield_unit TEXT DEFAULT 'шт' CHECK(yield_unit IN ('гр', 'кг', 'шт'))
    )`);

  await runStatement(`CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'гр' CHECK(unit IN ('гр', 'кг')),
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
  await addColumnIfNotExists('recipe_ingredients', 'unit', "unit TEXT NOT NULL DEFAULT 'гр'");
  await addColumnIfNotExists('baking_plans', 'status', "status TEXT DEFAULT 'planned'");

  await runStatement('BEGIN IMMEDIATE TRANSACTION');

  try {
    await normalizeDuplicateNames('ingredients');
    await normalizeDuplicateNames('recipes');

    await runStatement(`UPDATE ingredients
      SET unit = CASE
        WHEN unit IS NULL OR TRIM(unit) = '' THEN 'гр'
        WHEN LOWER(TRIM(unit)) IN ('гр', 'г', 'gram', 'grams', 'грамм', 'грамма', 'граммов') THEN 'гр'
        WHEN LOWER(TRIM(unit)) IN ('кг', 'kg', 'килограмм', 'килограмма', 'килограммов') THEN 'кг'
        ELSE TRIM(unit)
      END`);

    await runStatement(`UPDATE recipes
      SET yield_unit = CASE
        WHEN yield_unit IS NULL OR TRIM(yield_unit) = '' THEN 'шт'
        WHEN LOWER(TRIM(yield_unit)) IN ('гр', 'г', 'gram', 'grams', 'грамм', 'грамма', 'граммов') THEN 'гр'
        WHEN LOWER(TRIM(yield_unit)) IN ('кг', 'kg', 'килограмм', 'килограмма', 'килограммов') THEN 'кг'
        WHEN LOWER(TRIM(yield_unit)) IN ('шт', 'штука', 'штук', 'pcs', 'pc', 'piece', 'pieces') THEN 'шт'
        ELSE TRIM(yield_unit)
      END`);

    await runStatement(`UPDATE recipe_ingredients
      SET unit = CASE
        WHEN unit IS NULL OR TRIM(unit) = '' THEN (
          SELECT i.unit FROM ingredients i WHERE i.id = recipe_ingredients.ingredient_id
        )
        WHEN LOWER(TRIM(unit)) IN ('гр', 'г', 'gram', 'grams', 'грамм', 'грамма', 'граммов') THEN 'гр'
        WHEN LOWER(TRIM(unit)) IN ('кг', 'kg', 'килограмм', 'килограмма', 'килограммов') THEN 'кг'
        ELSE (
          SELECT i.unit FROM ingredients i WHERE i.id = recipe_ingredients.ingredient_id
        )
      END`);

    await runStatement(`UPDATE recipe_ingredients
      SET unit = COALESCE(unit, 'гр')`);

    const invalidIngredientsUnits = await readRows(`
      SELECT id, name, unit
      FROM ingredients
      WHERE unit NOT IN ('гр', 'кг')
      ORDER BY id
      LIMIT 5
    `);
    if (invalidIngredientsUnits.length > 0) {
      const sample = invalidIngredientsUnits
        .map((row) => `${row.id}:${row.name}=${row.unit}`)
        .join(', ');
      throw new Error(
        `Unsupported ingredient units found. Please normalize to \'гр\' or \'кг\'. Examples: ${sample}`,
      );
    }

    const invalidRecipeYieldUnits = await readRows(`
      SELECT id, name, yield_unit
      FROM recipes
      WHERE yield_unit NOT IN ('гр', 'кг', 'шт')
      ORDER BY id
      LIMIT 5
    `);
    if (invalidRecipeYieldUnits.length > 0) {
      const sample = invalidRecipeYieldUnits
        .map((row) => `${row.id}:${row.name}=${row.yield_unit}`)
        .join(', ');
      throw new Error(
        `Unsupported recipe yield units found. Please normalize to \'гр\', \'кг\', or \'шт\'. Examples: ${sample}`,
      );
    }

    const invalidRecipeIngredientUnits = await readRows(`
      SELECT ri.id, r.name as recipe_name, i.name as ingredient_name, ri.unit
      FROM recipe_ingredients ri
      JOIN recipes r ON r.id = ri.recipe_id
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.unit NOT IN ('гр', 'кг')
      ORDER BY ri.id
      LIMIT 5
    `);
    if (invalidRecipeIngredientUnits.length > 0) {
      const sample = invalidRecipeIngredientUnits
        .map((row) => `${row.id}:${row.recipe_name}/${row.ingredient_name}=${row.unit}`)
        .join(', ');
      throw new Error(
        `Unsupported recipe ingredient units found. Please normalize to \'гр\' or \'кг\'. Examples: ${sample}`,
      );
    }

    await runStatement(`CREATE TRIGGER IF NOT EXISTS ingredients_unit_validate_insert
      BEFORE INSERT ON ingredients
      FOR EACH ROW
      WHEN NEW.unit NOT IN ('гр', 'кг')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid ingredients unit');
      END`);

    await runStatement(`CREATE TRIGGER IF NOT EXISTS ingredients_unit_validate_update
      BEFORE UPDATE OF unit ON ingredients
      FOR EACH ROW
      WHEN NEW.unit NOT IN ('гр', 'кг')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid ingredients unit');
      END`);

    await runStatement(`CREATE TRIGGER IF NOT EXISTS recipes_yield_unit_validate_insert
      BEFORE INSERT ON recipes
      FOR EACH ROW
      WHEN NEW.yield_unit NOT IN ('гр', 'кг', 'шт')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid recipes yield unit');
      END`);

    await runStatement(`CREATE TRIGGER IF NOT EXISTS recipes_yield_unit_validate_update
      BEFORE UPDATE OF yield_unit ON recipes
      FOR EACH ROW
      WHEN NEW.yield_unit NOT IN ('гр', 'кг', 'шт')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid recipes yield unit');
      END`);

    await runStatement(`CREATE TRIGGER IF NOT EXISTS recipe_ingredients_unit_validate_insert
      BEFORE INSERT ON recipe_ingredients
      FOR EACH ROW
      WHEN NEW.unit NOT IN ('гр', 'кг')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid recipe ingredient unit');
      END`);

    await runStatement(`CREATE TRIGGER IF NOT EXISTS recipe_ingredients_unit_validate_update
      BEFORE UPDATE OF unit ON recipe_ingredients
      FOR EACH ROW
      WHEN NEW.unit NOT IN ('гр', 'кг')
      BEGIN
        SELECT RAISE(ABORT, 'Invalid recipe ingredient unit');
      END`);

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
      SET quantity = CASE
            WHEN unit = (
              SELECT i.unit
              FROM ingredients i
              WHERE i.id = recipe_ingredients.ingredient_id
            ) THEN quantity
            WHEN unit = 'кг' AND (
              SELECT i.unit
              FROM ingredients i
              WHERE i.id = recipe_ingredients.ingredient_id
            ) = 'гр' THEN quantity * 1000
            WHEN unit = 'гр' AND (
              SELECT i.unit
              FROM ingredients i
              WHERE i.id = recipe_ingredients.ingredient_id
            ) = 'кг' THEN quantity / 1000
            ELSE quantity
          END,
          unit = (
            SELECT i.unit
            FROM ingredients i
            WHERE i.id = recipe_ingredients.ingredient_id
          )`);
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
