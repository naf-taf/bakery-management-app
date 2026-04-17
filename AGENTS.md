# Bakery App AI Skills

This file defines reusable AI skills for the Bakery management app. Use these skills to implement new features, update database schema, and keep Electron/React conventions consistent.

## Project Overview

- Electron main process: `src/main/main.js`
- Preload bridge: `src/main/preload.js`
- React renderer app: `src/renderer/src/`
- React build assets: `src/renderer/build/`
- Database schema: `db/schema.sql`
- SQLite database file: `db/bakery.db`
- Root app scripts: `package.json`
- Renderer scripts: `src/renderer/package.json`

## Skills

### add-bakery-module

Use this skill when adding a new domain feature such as ingredients, recipes, baking plans, or kneading batches.

- Add database schema changes to `db/schema.sql`.
- Add or update table creation logic in `src/main/main.js` if the schema is created programmatically.
- Add IPC handlers in `src/main/main.js` for any new direct database operations.
- Expose safe renderer APIs in `src/main/preload.js` if new IPC calls are required.
- Create a React component in `src/renderer/src/` for the new view.
- Add a navigation button in `src/renderer/src/App.jsx` and route the view by state.
- Use `electronAPI.dbQuery()` and `electronAPI.dbRun()` in renderer code.

### add-database-table

Use this skill when adding a new table or changing schema.

- Modify `db/schema.sql` with the new table definition and constraints.
- Ensure foreign keys use `ON DELETE CASCADE` when appropriate.
- Keep existing tables stable and add default values for new columns when needed.
- Update any affected UI components or SQL queries in renderer components.

### add-ipc-handler

Use this skill to add new IPC-backed database operations.

- Add `ipcMain.handle('new-channel', async (event, args) => { ... })` in `src/main/main.js`.
- Confirm the channel name is descriptive and unique.
- Expose the new handler in `src/main/preload.js` via `contextBridge.exposeInMainWorld`.
- Call the handler from renderer via `window.electronAPI`.

### fix-db-access

Use this skill when renderer code is directly accessing SQLite or using unsafe patterns.

- Ensure the renderer only uses `window.electronAPI.dbQuery()` and `dbRun()`.
- Do not import `sqlite3` or use Node APIs in React components.
- Wrap database calls in try/catch and log errors to the console.

### update-react-view

Use this skill when changing UI state, view routing, or component structure.

- Maintain the `App.jsx` navigation button pattern.
- Keep the current-view state in `App.jsx` and conditionally render components.
- Prefer small local state updates inside each component.
- Preserve inline style patterns unless a refactor to `App.css` is requested.

### package-app

Use this skill when packaging or preparing a release.

- Run `npm install` in the root and `cd src/renderer && npm install`.
- Build the renderer with `npm run build` from the root.
- Start the production app with `npm start`.
- Package the app with `npm run dist`.

## Usage Notes

- Always use the renderer package for UI work and the root package for Electron work.
- The app uses Vite for the renderer; keep `src/renderer/index.html` and `src/renderer/vite.config.js` in sync with renderer build/dev behavior.
- `db/bakery.db` is generated automatically during app startup; do not commit generated database files.
- Follow existing bilingual UI conventions: code is English, visible labels may be Russian.
