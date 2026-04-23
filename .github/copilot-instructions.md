# Bakery Management App - Copilot Instructions

This repository is an Electron desktop app with a React + Vite renderer and SQLite storage.

## Project Map

- Main process: `src/main/main.js`
- Preload bridge: `src/main/preload.js`
- Renderer app: `src/renderer/src/`
- Renderer entry HTML: `src/renderer/index.html`
- Renderer config: `src/renderer/vite.config.js`
- Database schema: `db/schema.sql`

## Build, Test, And Validate

Run commands from repository root unless stated otherwise.

- Install root dependencies: `npm install`
- Install renderer dependencies: `npm install --prefix src/renderer`
- Dev mode (Electron + Vite): `npm run dev`
- Build renderer: `npm run build`
- Package Electron app: `npm run dist`
- Production smoke check: `npm start`

When making code changes, validate at minimum:

1. `npm run build` succeeds.
2. `npm run dist` succeeds for packaging-sensitive changes.
3. No renderer code bypasses preload IPC.

## Architecture Rules

- Keep `contextIsolation: true` and `nodeIntegration: false`.
- Renderer must not import Node modules or access SQLite directly.
- Database operations are routed through `window.electronAPI` only.
- IPC channels are defined in main process and exposed in preload.
- In dev, load `http://localhost:5173`; in packaged mode, load renderer from `src/renderer/build/index.html`.

## Database Conventions

- Schema changes go to `db/schema.sql`.
- Keep runtime table creation/migration logic in `src/main/main.js` aligned with schema.
- Use foreign keys and `ON DELETE CASCADE` where relationships require cleanup.

## UI Conventions

- Follow existing navigation pattern in `src/renderer/src/App.jsx`.
- Use React hooks for component state and side effects.
- Keep visible labels aligned with current bilingual style (English code, Russian UI labels where already used).

## Display Conventions

- Ingredient quantities in `кг` are shown with 3 decimal places (precision to 1 gram).
- Ingredient quantities in `гр` are shown as whole integers.
- Apply the same logic in both UI (`KneadingLists.jsx`) and PDF export (`pdfExport.js`).

## Release And CI

- CI workflow validates branch/PR builds.
- Release workflow triggers on tags matching `v*.*.*`.
- Current version: `1.0.4`. Bump version in **both** `package.json` and `src/renderer/package.json`.
- Standard release flow (must be followed every time):
  1. Bump version in both `package.json` files.
  2. Commit and push to `main`.
  3. Create annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
  4. Push tag: `git push origin vX.Y.Z` — this triggers the release pipeline.
- SemVer rule: PATCH for fixes, MINOR for new features, MAJOR for breaking changes.

## Change Scope Guidance

- Prefer minimal, targeted edits.
- Preserve existing code style and file structure.
- Avoid broad refactors unless explicitly requested.
- Add concise error handling around DB and IPC operations when touching those areas.
