"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const http_1 = __importDefault(require("http"));
const PORT = 3579; // fixed port to avoid conflicts
let nextProcess = null;
let mainWindow = null;
let splashWindow = null;
// ─── Path resolution ──────────────────────────────────────────────────────────
function getResourcePath(...segments) {
    if (electron_1.app.isPackaged) {
        return path_1.default.join(process.resourcesPath, 'app', ...segments);
    }
    return path_1.default.join(electron_1.app.getAppPath(), '.next', 'standalone', ...segments);
}
function getStaticPath() {
    if (electron_1.app.isPackaged) {
        return path_1.default.join(process.resourcesPath, 'app', '.next', 'static');
    }
    return path_1.default.join(electron_1.app.getAppPath(), '.next', 'static');
}
// ─── Splash window ────────────────────────────────────────────────────────────
function createSplash() {
    splashWindow = new electron_1.BrowserWindow({
        width: 380,
        height: 260,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        transparent: false,
        backgroundColor: '#0C0C0E',
        webPreferences: { contextIsolation: true },
    });
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0C0C0E;
    color: #E8E6E1;
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 20px;
    -webkit-app-region: drag;
  }
  .logo {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: linear-gradient(135deg, #D4A054, rgba(212,160,84,0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Courier New', monospace;
    font-size: 28px;
    font-weight: 700;
    color: #0C0C0E;
  }
  h1 {
    font-family: 'Courier New', monospace;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: #E8E6E1;
  }
  .subtitle {
    font-size: 11px;
    color: #55555F;
    letter-spacing: 0.05em;
    margin-top: -12px;
  }
  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid #2A2A35;
    border-top-color: #D4A054;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-top: 8px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status {
    font-size: 12px;
    color: #8A8A95;
    letter-spacing: 0.03em;
  }
</style>
</head>
<body>
  <div class="logo">N</div>
  <h1>NEXUS</h1>
  <p class="subtitle">Command Center</p>
  <div class="spinner"></div>
  <p class="status">Запуск сервера...</p>
</body>
</html>`;
    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}
// ─── Server health check ──────────────────────────────────────────────────────
function waitForServer(timeout = 45000) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
            const req = http_1.default.get(`http://localhost:${PORT}/`, (res) => {
                res.resume();
                resolve();
            });
            req.on('error', () => {
                if (Date.now() - started > timeout) {
                    reject(new Error('Тайм-аут: сервер не запустился за 45 секунд'));
                }
                else {
                    setTimeout(check, 600);
                }
            });
            req.setTimeout(1000, () => req.destroy());
        };
        check();
    });
}
// ─── Start Next.js server ─────────────────────────────────────────────────────
function startNextServer() {
    return new Promise((resolve, reject) => {
        const serverJs = getResourcePath('server.js');
        nextProcess = (0, child_process_1.spawn)(process.execPath, [serverJs], {
            env: {
                ...process.env,
                PORT: String(PORT),
                NODE_ENV: 'production',
                HOSTNAME: '127.0.0.1',
                // Static files path for standalone build
                NEXT_SHARP_PATH: '',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        nextProcess.stdout?.on('data', (d) => {
            const msg = d.toString();
            console.log('[Next]', msg.trim());
            if (msg.includes('ready') || msg.includes('started'))
                resolve();
        });
        nextProcess.stderr?.on('data', (d) => {
            console.error('[Next:err]', d.toString().trim());
        });
        nextProcess.on('error', reject);
        nextProcess.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                reject(new Error(`Сервер завершился с кодом ${code}`));
            }
        });
        // Also resolve via HTTP poll regardless of stdout
        waitForServer().then(resolve).catch(reject);
    });
}
// ─── Main window ─────────────────────────────────────────────────────────────
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 640,
        backgroundColor: '#0C0C0E',
        show: false,
        title: 'NEXUS — Command Center',
        icon: path_1.default.join(electron_1.app.getAppPath(), 'electron', 'icon.ico'),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });
    mainWindow.loadURL(`http://localhost:${PORT}/dashboard`);
    mainWindow.once('ready-to-show', () => {
        splashWindow?.close();
        splashWindow = null;
        mainWindow?.show();
        mainWindow?.focus();
    });
    // Open external links in the system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(`http://localhost:${PORT}`)) {
            electron_1.shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
    mainWindow.on('closed', () => { mainWindow = null; });
}
// ─── IPC handlers ─────────────────────────────────────────────────────────────
electron_1.ipcMain.on('window:minimize', () => mainWindow?.minimize());
electron_1.ipcMain.on('window:maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
});
electron_1.ipcMain.on('window:close', () => mainWindow?.close());
// ─── App lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(async () => {
    createSplash();
    try {
        await startNextServer();
        createMainWindow();
    }
    catch (err) {
        console.error('Ошибка запуска:', err);
        splashWindow?.close();
        electron_1.app.quit();
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createMainWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('before-quit', () => {
    if (nextProcess && !nextProcess.killed) {
        nextProcess.kill('SIGTERM');
    }
});
