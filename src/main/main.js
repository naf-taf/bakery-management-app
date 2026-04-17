const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/build/index.html')); // For production

  // For debugging, uncomment:
  // mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Initialize database - use app user data directory for packaged app
  const dbDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'db')
    : path.join(__dirname, '../../db');

  // Ensure db directory exists
  const fs = require('fs');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'bakery.db');

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to SQLite database at:', dbPath);
      createTables();
    }
  });

  createWindow();
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
  console.log('db-query handler called:', query, params);
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
        console.log('Query success, rows:', rows?.length || 0);
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('db-run', async (event, query, params) => {
  console.log('db-run handler called:', query, params);
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
        console.log('Run success, lastID:', this.lastID, 'changes:', this.changes);
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
});

function addColumnIfNotExists(table, columnName, columnDefinition) {
  db.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) {
      console.error(`Failed to read table info for ${table}:`, err);
      return;
    }

    const exists = rows.some((row) => row.name === columnName);
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}`, (alterErr) => {
        if (alterErr) {
          console.error(`Failed to add column ${columnName} to ${table}:`, alterErr);
        } else {
          console.log(`Added missing column ${columnName} to ${table}`);
        }
      });
    }
  });
}

function createTables() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // Ingredients table
    db.run(`CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      cost_per_unit REAL DEFAULT 0
    )`);

    // Recipes table
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      yield_quantity INTEGER DEFAULT 1,
      yield_unit TEXT DEFAULT 'шт'
    )`);

    // Recipe ingredients junction table
    db.run(`CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER,
      ingredient_id INTEGER,
      quantity REAL NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    )`);

    // Baking plans table
    db.run(`CREATE TABLE IF NOT EXISTS baking_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      recipe_id INTEGER,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'planned',
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )`);

    // Kneading batches table
    db.run(`CREATE TABLE IF NOT EXISTS kneading_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      batch_time TEXT,
      notes TEXT,
      FOREIGN KEY (plan_id) REFERENCES baking_plans(id) ON DELETE CASCADE
    )`);

    // Migrate old schema if columns are missing
    addColumnIfNotExists('recipes', 'yield_quantity', 'yield_quantity INTEGER DEFAULT 1');
    addColumnIfNotExists('recipes', 'yield_unit', "yield_unit TEXT DEFAULT 'шт'");
    addColumnIfNotExists('recipe_ingredients', 'recipe_id', 'recipe_id INTEGER');
    addColumnIfNotExists('recipe_ingredients', 'ingredient_id', 'ingredient_id INTEGER');
    addColumnIfNotExists('recipe_ingredients', 'quantity', 'quantity REAL NOT NULL');
    addColumnIfNotExists('baking_plans', 'status', "status TEXT DEFAULT 'planned'");
  });
}
