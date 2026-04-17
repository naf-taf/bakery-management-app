# Bakery App Skills

This file provides AI skill definitions and conventions for the Bakery management application.

## Intent

Use this file to guide AI agents when adding features, updating the database, or working across the Electron renderer/main boundary.

## Skills

### add-bakery-module

Use when adding a new feature module such as ingredients, recipes, baking plans, or kneading batches.

- Update `db/schema.sql` for any new tables or schema changes.
- Add IPC handlers in `src/main/main.js` if the renderer needs new database operations.
- Expose safe renderer APIs in `src/main/preload.js` using `contextBridge.exposeInMainWorld`.
- Add a new React component in `src/renderer/src/` for the module.
- Add navigation support in `src/renderer/src/App.js` and conditionally render the new view.
- Use `electronAPI.dbQuery()` / `electronAPI.dbRun()` from renderer components.

### add-database-table

Use when introducing or modifying database tables.

- Keep schema changes in `db/schema.sql`.
- Prefer `ON DELETE CASCADE` for foreign keys when the child should be removed with the parent.
- Preserve existing table compatibility by adding defaults for new columns.
- Update renderer SQL queries to include new columns or relations.

### add-ipc-handler

Use when adding main-renderer communication for database actions.

- Add a descriptive `ipcMain.handle('channel-name', async (event, args) => { ... })` in `src/main/main.js`.
- Expose the handler through `src/main/preload.js`.
- Call it from renderer using `window.electronAPI`.

### fix-db-access

Use when renderer code is directly accessing the database or using unsafe Node integration.

- Renderer code must only use the preload API: `electronAPI.dbQuery()` and `electronAPI.dbRun()`.
- Do not import `sqlite3` or Node modules in React components.
- Wrap IPC/DB calls in `try/catch` and log errors.

### update-react-view

Use when modifying UI routing or component views.

- Keep navigation state in `src/renderer/src/App.js`.
- Render views conditionally based on the current view state.
- Keep component state local where possible.

### package-app

Use when running builds or packaging releases.

- Install dependencies in root and renderer separately.
- Build renderer with `npm run build` from the root.
- Start production with `npm start`.
- Package the app with `npm run dist`.

## Notes

- Root `package.json` is for Electron, `src/renderer/package.json` is for the React app.
- The app uses Create React App for renderer development.
- `db/bakery.db` is generated automatically and should not be committed.
- Visible UI labels may use Russian text while code remains English.
