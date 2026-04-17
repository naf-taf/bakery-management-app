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
