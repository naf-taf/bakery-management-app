# Bakery App AI Skills

This file defines reusable skills for coding agents working in this repository.

## Project Overview

- Main process: `src/main/main.js`
- Preload bridge: `src/main/preload.js`
- Renderer app: `src/renderer/src/`
- Renderer build output: `src/renderer/build/`
- Database schema: `db/schema.sql`
- Root scripts: `package.json`
- Renderer scripts: `src/renderer/package.json`

## Global Rules

- Keep Electron security defaults: `contextIsolation: true`, `nodeIntegration: false`.
- Renderer must not access SQLite directly.
- Use preload IPC (`window.electronAPI`) for DB operations.
- Keep changes small, scoped, and consistent with existing style.

## Skills

### add-bakery-module

Use when adding a new business module.

1. Update schema in `db/schema.sql` if needed.
2. Add/adjust table init or migration logic in `src/main/main.js`.
3. Add IPC handlers in main and expose them in preload if new channels are required.
4. Implement the UI module in `src/renderer/src/`.
5. Wire navigation through `src/renderer/src/App.jsx`.

### add-database-table

Use when introducing or evolving DB tables.

1. Add table and constraints in `db/schema.sql`.
2. Prefer backward-compatible migrations in `src/main/main.js`.
3. Use `ON DELETE CASCADE` where relationship cleanup is expected.
4. Update affected SQL calls in renderer features.

### add-ipc-handler

Use when renderer needs a new backend operation.

1. Add `ipcMain.handle(...)` in `src/main/main.js`.
2. Expose a safe preload API in `src/main/preload.js`.
3. Consume via `window.electronAPI` in renderer.
4. Add error handling around async calls.

### update-react-view

Use for UI and navigation changes.

1. Maintain the current `App.jsx` view-switching pattern.
2. Keep local state in feature components.
3. Preserve bilingual text conventions.
4. Avoid broad style rewrites unless requested.

### package-and-release

Use before merging release-related changes.

1. `npm install`
2. `npm install --prefix src/renderer`
3. `npm run build`
4. `npm run dist`
5. Push a semantic version tag `vX.Y.Z` to trigger release workflow.

## Validation Checklist

- Build passes: `npm run build`
- Packaging passes (for release-impacting changes): `npm run dist`
- No direct Node/SQLite usage added to renderer
- Schema and runtime migration logic remain aligned

## Notes

- The app database is generated at runtime; do not commit generated `db/bakery.db`.
- Release artifacts are produced in `dist/`.
