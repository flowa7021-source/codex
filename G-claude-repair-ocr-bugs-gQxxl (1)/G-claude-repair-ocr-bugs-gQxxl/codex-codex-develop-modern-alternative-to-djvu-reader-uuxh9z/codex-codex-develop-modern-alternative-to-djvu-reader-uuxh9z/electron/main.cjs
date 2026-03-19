const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// ─── Performance flags for large files (500MB+) ─────────────────────────────
// Increase V8 heap limit from default ~1.7GB to 4GB so huge documents
// don't trigger OOM crashes. Also enable GPU rasterization for canvas perf.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// Disable renderer backgrounding so page rendering stays fast when
// the window temporarily loses focus during long operations.
app.commandLine.appendSwitch('disable-renderer-backgrounding');

function createWindow() {
  // Security: prevent navigation to external URLs
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'file:') {
        event.preventDefault();
      }
    });
  });

  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'NovaReader',
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    }
  });

  const indexPath = path.join(__dirname, '..', 'app', 'index.html');
  win.loadFile(indexPath);

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch { /* ignore invalid URLs */ }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
