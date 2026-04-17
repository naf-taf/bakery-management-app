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

Release steps:

```bash
# 1) Update versions in package.json files if needed

# 2) Commit changes
git add .
git commit -m "chore: release 1.0.1"

# 3) Create and push a version tag
git tag v1.0.1
git push origin main --tags
```

After the tag push, GitHub Actions will create the release and attach installer/portable artifacts automatically.

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
