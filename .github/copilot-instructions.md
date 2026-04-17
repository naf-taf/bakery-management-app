# Bakery Management App - AI Agent Instructions

This is an Electron + React desktop application for bakery operations management. See [README.md](../README.md) for setup and project overview.

## Essential Commands

| Task                     | Command         |
| ------------------------ | --------------- |
| Development (hot reload) | `npm run dev`   |
| Build renderer app       | `npm run build` |
| Start production app     | `npm start`     |
| Package as distributable | `npm run dist`  |

**Key Detail**: Root `package.json` is for Electron; `src/renderer/package.json` is for React. Install renderer deps with `cd src/renderer && npm install`.

## Architecture & Key Files

### IPC Communication Pattern

- **Preload Bridge**: [src/main/preload.js](../src/main/preload.js) exposes `window.electronAPI` with `dbQuery()` and `dbRun()` methods
- **Main Process**: [src/main/main.js](../src/main/main.js) handles database init and IPC listeners
- **Security**: contextIsolation enabled, nodeIntegration disabled - all database access goes through IPC
- **Usage in Components**: `const { electronAPI } = window;` then `await electronAPI.dbQuery(sql, params)`

### Database

- SQLite database at `db/bakery.db` (created automatically on app start)
- Schema: [db/schema.sql](../db/schema.sql) - defines ingredients, recipes, baking_plans, kneading_batches
- Foreign key relationships are enforced; use CASCADE deletes as appropriate

### Components

- Navigation-based view system in [src/renderer/src/App.jsx](../src/renderer/src/App.jsx)
- Each module (Ingredients, Recipes, BakingPlans, KneadingLists) is a React component in `src/renderer/src/`
- UI uses inline styles; consider extracting to `App.css` for consistency

## Development Conventions

- **React Hooks**: Use `useState`, `useEffect` for state and side effects
- **Async Database**: All database calls use `async/await` with `electronAPI` bridge
- **Error Handling**: Wrap `electronAPI` calls in try/catch; log errors to console
- **i18n Context**: UI text is bilingual (English code, Russian labels in JSX)

## Common Pitfalls

1. **Two package.json files**: Don't forget to run `npm install` in both root and `src/renderer`
2. **Production vs Dev**: Production mode loads built renderer from `src/renderer/build/index.html`; dev mode uses `http://localhost:5173`
3. **Database Paths**: All database operations use paths relative to `src/main/main.js`; paths in renderer must go through IPC
4. **IPC Calls Are Async**: Always `await` when calling `electronAPI.dbQuery()` or `dbRun()`

## New Features

When adding features:

1. Add database schema changes to [db/schema.sql](../db/schema.sql)
2. Add IPC listeners in `src/main/main.js` if needed
3. Create React component in `src/renderer/src/` with `electronAPI` calls
4. Add navigation button in `App.jsx` to expose the new view
