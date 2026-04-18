const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const sqliteBinaryPath = path.join(
    projectRoot,
    'node_modules',
    'sqlite3',
    'build',
    'Release',
    'node_sqlite3.node',
);
const stampDir = path.join(projectRoot, 'node_modules', '.cache');
const stampPath = path.join(stampDir, 'bakery-native-deps.json');

const currentStamp = {
    electron: packageJson.devDependencies?.electron || '',
    sqlite3: packageJson.dependencies?.sqlite3 || '',
    platform: process.platform,
    arch: process.arch,
};

function loadStoredStamp() {
    if (!fs.existsSync(stampPath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(stampPath, 'utf8'));
    } catch {
        return null;
    }
}

function stampsMatch(left, right) {
    return (
        left &&
        right &&
        left.electron === right.electron &&
        left.sqlite3 === right.sqlite3 &&
        left.platform === right.platform &&
        left.arch === right.arch
    );
}

function saveStamp() {
    fs.mkdirSync(stampDir, { recursive: true });
    fs.writeFileSync(stampPath, JSON.stringify(currentStamp, null, 2));
}

function runInstallAppDeps() {
    const npmCliPath = process.env.npm_execpath;

    if (!npmCliPath) {
        console.error('Unable to locate npm CLI path for native dependency rebuild.');
        process.exit(1);
    }

    const result = spawnSync(process.execPath, [npmCliPath, 'run', 'install-app-deps'], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: false,
    });

    if (result.error) {
        console.error('Failed to launch native dependency rebuild:', result.error);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

const storedStamp = loadStoredStamp();
const shouldRebuild = !fs.existsSync(sqliteBinaryPath) || !stampsMatch(currentStamp, storedStamp);

if (shouldRebuild) {
    console.log('Native deps are missing or outdated. Rebuilding Electron native modules...');
    runInstallAppDeps();
    saveStamp();
} else {
    console.log('Native deps are up to date. Skipping rebuild.');
}
