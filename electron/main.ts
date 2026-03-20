import { app, BrowserWindow, shell, ipcMain } from 'electron'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import http from 'http'
import { initDatabase } from './db-init'

const PORT = 3579 // fixed port to avoid conflicts
let nextProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let databasePath = ''

// ─── Path resolution ──────────────────────────────────────────────────────────

function getResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', ...segments)
  }
  return path.join(app.getAppPath(), '.next', 'standalone', ...segments)
}

function getStaticPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', '.next', 'static')
  }
  return path.join(app.getAppPath(), '.next', 'static')
}

// ─── Splash window ────────────────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 260,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#0C0C0E',
    webPreferences: { contextIsolation: true },
  })

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
</html>`

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

// ─── Server health check ──────────────────────────────────────────────────────

function waitForServer(timeout = 45000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      const req = http.get(`http://localhost:${PORT}/`, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - started > timeout) {
          reject(new Error('Тайм-аут: сервер не запустился за 45 секунд'))
        } else {
          setTimeout(check, 600)
        }
      })
      req.setTimeout(1000, () => req.destroy())
    }
    check()
  })
}

// ─── Start Next.js server ─────────────────────────────────────────────────────

function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverJs = getResourcePath('server.js')

    nextProcess = spawn(process.execPath, [serverJs], {
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        DATABASE_PATH: databasePath,
        // Static files path for standalone build
        NEXT_SHARP_PATH: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    nextProcess.stdout?.on('data', (d: Buffer) => {
      const msg = d.toString()
      console.log('[Next]', msg.trim())
      if (msg.includes('ready') || msg.includes('started')) resolve()
    })

    nextProcess.stderr?.on('data', (d: Buffer) => {
      console.error('[Next:err]', d.toString().trim())
    })

    nextProcess.on('error', reject)
    nextProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Сервер завершился с кодом ${code}`))
      }
    })

    // Also resolve via HTTP poll regardless of stdout
    waitForServer().then(resolve).catch(reject)
  })
}

// ─── Main window ─────────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0C0C0E',
    show: false,
    title: 'NEXUS — Command Center',
    icon: app.isPackaged
      ? undefined
      : path.join(app.getAppPath(), 'electron', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  mainWindow.loadURL(`http://localhost:${PORT}/dashboard`)

  mainWindow.once('ready-to-show', () => {
    splashWindow?.close()
    splashWindow = null
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Initialise SQLite database before starting the Next.js server
  const userDataDir = app.getPath('userData')
  databasePath = path.join(userDataDir, 'nexus.db')
  try {
    initDatabase(databasePath)
  } catch (err: any) {
    console.error('Ошибка инициализации БД:', err)
  }

  createSplash()

  try {
    await startNextServer()
    createMainWindow()
  } catch (err: any) {
    console.error('Ошибка запуска:', err)
    splashWindow?.close()
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill('SIGTERM')
  }
})
