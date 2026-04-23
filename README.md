# Bakery Management Desktop App

A desktop application for managing bakery operations including ingredients, recipes, baking plans, and kneading lists.

## Features

- Ingredient database management
- Recipe creation and management
- Baking plan composition
- Kneading list generation for bakers

## Tech Stack

- **Frontend**: React + Vite
- **Desktop Framework**: Electron
- **Database**: SQLite
- **Language**: JavaScript

## Setup

1. Install dependencies:

   ```bash
   npm install
   cd src/renderer && npm install
   ```

2. Build the React app:

   ```bash
   npm run build
   ```

3. Run the app:
   ```bash
   npm start
   ```

## Development

For development with hot reload:

```bash
npm run dev
```

This will start the Vite dev server and Electron app concurrently.

Vite dev server runs at `http://localhost:5173`.

## Published Version

When the app is built for distribution, use the packaged installer or portable output found in the `dist/` folder.

- Run from repo root: `npm run dist`
- This builds the React renderer and packages the Electron app with `electron-builder`
- Published artifacts are written to `dist/`
- On Windows, the default output includes an NSIS installer and a portable executable

To install or run the published version, open the generated installer or portable artifact from `dist/`.

## Versioning And Auto Releases

The project uses tag-based releases.

- CI (`.github/workflows/ci.yml`) runs on `main` and pull requests for validation builds.
- Release workflow (`.github/workflows/release.yml`) runs automatically when a Git tag matching `v*.*.*` is pushed.
- The release workflow builds the app and publishes GitHub Release assets from `dist/`.

Recommended release steps:

```bash
# 1) Choose next semantic version (MAJOR.MINOR.PATCH)
# Example used below: 1.0.4

# 2) Bump version in both package.json files (without creating git tag yet)
npm version 1.0.4 --no-git-tag-version
npm version 1.0.4 --no-git-tag-version --prefix src/renderer

# 3) Validate build and packaging
npm run build
npm run dist

# 4) Commit version changes
git add .
git commit -m "chore: release 1.0.4"

# 5) Create and push an annotated version tag
git tag -a v1.0.4 -m "Release v1.0.4"
git push origin main
git push origin v1.0.4
```

After the tag is pushed, GitHub Actions starts `.github/workflows/release.yml`, creates the GitHub Release, and attaches installer/portable artifacts from `dist/`.

Notes:

- Keep root `package.json` and `src/renderer/package.json` on the same version.
- Use tag format exactly as `vX.Y.Z` (for example `v1.0.4`) so release automation is triggered.
- SemVer bump rule: increment PATCH for fixes (`1.0.3 -> 1.0.4`), MINOR for backward-compatible features (`1.0.3 -> 1.1.0`), MAJOR for breaking changes (`1.0.3 -> 2.0.0`).

Quick release checklist (copy-paste):

```bash
# Set next version once
set VERSION=1.0.4

# Bump both package versions
npm version %VERSION% --no-git-tag-version
npm version %VERSION% --no-git-tag-version --prefix src/renderer

# Validate
npm run build
npm run dist

# Commit and tag
git add .
git commit -m "chore: release %VERSION%"
git tag -a v%VERSION% -m "Release v%VERSION%"

# Push branch and tag
git push origin main
git push origin v%VERSION%
```

## Database

The app uses SQLite database stored in `db/bakery.db`. Schema is defined in `db/schema.sql`.

## Project Structure

```
src/
├── main/
│   ├── main.js          # Electron main process
│   └── preload.js       # Preload script for IPC
└── renderer/
      ├── index.html        # Vite HTML entry
      ├── vite.config.js    # Vite config
    └── src/
            ├── App.jsx        # Main React app
        ├── App.css      # Styles
            └── index.jsx      # React entry point
db/
└── schema.sql           # Database schema
```
