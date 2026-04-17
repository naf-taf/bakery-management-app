-- SQLite database schema for Bakery App

-- Ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL, -- e.g., 'kg', 'l', 'pcs'
  cost_per_unit REAL DEFAULT 0
);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  yield_quantity INTEGER DEFAULT 1, -- how many items the recipe makes
  yield_unit TEXT DEFAULT 'шт'
);

-- Recipe ingredients junction table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  UNIQUE(recipe_id, ingredient_id)
);

-- Baking plans table
CREATE TABLE IF NOT EXISTS baking_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  recipe_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL, -- how many to bake
  status TEXT DEFAULT 'planned', -- 'planned', 'in_progress', 'completed'
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  UNIQUE(date, recipe_id)
);

-- Kneading batches table (for grouping dough preparations)
CREATE TABLE IF NOT EXISTS kneading_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  batch_time TEXT, -- when to start kneading
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES baking_plans(id) ON DELETE CASCADE
);
