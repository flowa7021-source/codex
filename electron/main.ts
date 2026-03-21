import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import Database from 'better-sqlite3'
import { initDatabase } from './db-init'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let databasePath = ''
let db: Database.Database | null = null

// ─── Performance flags (before app ready) ─────────────────────────────────────
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('js-flags', '--expose-gc')

// ─── Single-instance lock ──────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// ─── Custom protocol (serves Next.js static export) ──────────────────────────
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true },
}])

// ─── Path helpers ─────────────────────────────────────────────────────────────
function getStaticDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(app.getAppPath(), 'out')
}

// ─── Splash window ────────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#0C0C0E',
    center: true,
    webPreferences: { contextIsolation: true, backgroundThrottling: false },
  })

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    background: #0C0C0E;
    color: #E8E6E1;
    font-family: 'Courier New', 'Consolas', monospace;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    -webkit-app-region: drag;
    user-select: none;
    overflow: hidden;
    position: relative;
  }

  /* Subtle grid */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(212,160,84,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212,160,84,0.04) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
  }

  /* Corner brackets */
  .corner {
    position: absolute;
    width: 18px; height: 18px;
    border-color: rgba(212,160,84,0.35);
    border-style: solid;
  }
  .tl { top:14px; left:14px;  border-width: 1px 0 0 1px; }
  .tr { top:14px; right:14px; border-width: 1px 1px 0 0; }
  .bl { bottom:14px; left:14px;  border-width: 0 0 1px 1px; }
  .br { bottom:14px; right:14px; border-width: 0 1px 1px 0; }

  .wrap {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    animation: fadeUp 0.5s ease-out forwards;
  }

  /* Logo */
  .logo-outer {
    position: relative;
    margin-bottom: 18px;
  }
  .logo-ring {
    position: absolute;
    inset: -10px;
    border: 1px solid rgba(212,160,84,0.18);
    border-radius: 50%;
    animation: ringPulse 2.4s ease-in-out infinite;
  }
  .logo-ring2 {
    position: absolute;
    inset: -20px;
    border: 1px solid rgba(212,160,84,0.07);
    border-radius: 50%;
    animation: ringPulse 2.4s ease-in-out 0.4s infinite;
  }
  .logo {
    width: 68px; height: 68px;
    border-radius: 16px;
    background: linear-gradient(135deg, #D4A054 0%, rgba(212,160,84,0.45) 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 34px; font-weight: 700; color: #0C0C0E;
    box-shadow:
      0 0 0 1px rgba(212,160,84,0.3),
      0 0 32px rgba(212,160,84,0.18),
      0 8px 24px rgba(0,0,0,0.5);
    letter-spacing: -1px;
  }

  .name {
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.28em;
    color: #E8E6E1;
    margin-bottom: 4px;
    text-shadow: 0 0 20px rgba(212,160,84,0.15);
  }

  .tagline {
    font-size: 9px;
    color: #3A3A48;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 22px;
  }

  /* Progress */
  .progress-outer {
    width: 180px;
    margin-bottom: 10px;
  }
  .progress-track {
    height: 2px;
    background: #1E1E26;
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }
  .progress-bar {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(to right, #D4A054, rgba(212,160,84,0.55));
    box-shadow: 0 0 8px rgba(212,160,84,0.4);
    animation: progFill 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    width: 0;
  }
  .progress-glow {
    position: absolute;
    top: 0; right: 0;
    width: 30px; height: 100%;
    background: linear-gradient(to right, transparent, rgba(212,160,84,0.6));
    animation: glowSlide 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    transform: translateX(-100%);
  }

  /* Status text */
  .status {
    font-size: 10px;
    color: #3A3A48;
    letter-spacing: 0.06em;
    height: 13px;
    text-align: center;
    animation: statusCycle 2.2s ease-out forwards;
  }

  /* Dots */
  .dots { display:flex; gap:5px; margin-top:14px; }
  .dot {
    width: 4px; height: 4px; border-radius: 50%;
    background: #D4A054; opacity: 0.3;
    animation: dotPulse 1.1s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.18s; }
  .dot:nth-child(3) { animation-delay: 0.36s; }

  /* Version */
  .ver {
    position: absolute;
    bottom: 16px; right: 18px;
    font-size: 9px; color: #2A2A35;
    letter-spacing: 0.05em;
  }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes ringPulse {
    0%,100% { transform:scale(1);   opacity:0.5; }
    50%      { transform:scale(1.06); opacity:1;   }
  }
  @keyframes progFill {
    0%  { width:0;   }
    15% { width:22%; }
    40% { width:55%; }
    70% { width:78%; }
    90% { width:92%; }
    100%{ width:97%; }
  }
  @keyframes glowSlide {
    0%  { transform:translateX(-200%); }
    100%{ transform:translateX(600%);  }
  }
  @keyframes dotPulse {
    0%,80%,100% { opacity:0.25; transform:scale(0.75); }
    40%          { opacity:1;    transform:scale(1);    }
  }
  @keyframes statusCycle {
    0%   { opacity:1; }
    33%  { opacity:0.6; }
    66%  { opacity:0.9; }
    100% { opacity:0.5; }
  }
</style>
</head>
<body>
  <div class="corner tl"></div>
  <div class="corner tr"></div>
  <div class="corner bl"></div>
  <div class="corner br"></div>

  <div class="wrap">
    <div class="logo-outer">
      <div class="logo-ring2"></div>
      <div class="logo-ring"></div>
      <div class="logo">N</div>
    </div>

    <div class="name">NEXUS</div>
    <div class="tagline">Operations Command Center</div>

    <div class="progress-outer">
      <div class="progress-track">
        <div class="progress-bar"></div>
        <div class="progress-glow"></div>
      </div>
    </div>
    <div class="status" id="st">Инициализация...</div>

    <div class="dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  </div>

  <div class="ver">v1.0.0</div>

  <script>
    const messages = [
      'Инициализация базы данных...',
      'Загрузка компонентов...',
      'Подготовка интерфейса...',
      'Почти готово...',
    ]
    const el = document.getElementById('st')
    let i = 0
    const timer = setInterval(() => {
      i = (i + 1) % messages.length
      if (el) el.textContent = messages[i]
    }, 550)
  </script>
</body>
</html>`

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

// ─── Database (IPC handlers) ───────────────────────────────────────────────────
function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised')
  return db
}

function registerIpcHandlers(): void {
  ipcMain.handle('db:metrics:overview', () => {
    const d = getDb()
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const n = (sql: string, ...p: any[]) =>
      ((d.prepare(sql).get(...p) as any).c as number)
    return {
      documentsInProgress: n(`SELECT COUNT(*) as c FROM documents WHERE status IN ('ACTIVE','REVIEW')`),
      documentsTotal:      n(`SELECT COUNT(*) as c FROM documents`),
      tasksCompletedThisWeek: n(`SELECT COUNT(*) as c FROM tasks WHERE status='DONE' AND completedAt >= ?`, weekAgo),
      totalTasksThisWeek:     n(`SELECT COUNT(*) as c FROM tasks WHERE createdAt >= ?`, weekAgo),
      teamOnline: n(`SELECT COUNT(*) as c FROM users WHERE status='ONLINE'`),
      teamTotal:  n(`SELECT COUNT(*) as c FROM users`),
      avgKpi: 87,
      deltas: { documents: 12, tasks: 8, team: 0, kpi: -3 },
    }
  })

  ipcMain.handle('db:metrics:weekly', () => {
    const rows = getDb()
      .prepare(`SELECT tasksCompleted, documentsCompleted FROM daily_metrics ORDER BY date ASC LIMIT 7`)
      .all() as any[]
    return rows.map(r => r.tasksCompleted + r.documentsCompleted)
  })

  ipcMain.handle('db:documents', (_e, params: any = {}) => {
    const d = getDb()
    const { page = 1, pageSize = 20, status, priority, authorId, search } = params
    const conds: string[] = []
    const vals: any[] = []
    if (status)   { conds.push('d.status = ?');    vals.push(status) }
    if (priority) { conds.push('d.priority = ?');  vals.push(priority) }
    if (authorId) { conds.push('d.authorId = ?');  vals.push(authorId) }
    if (search)   { conds.push('(d.title LIKE ? OR d.number LIKE ?)'); vals.push(`%${search}%`, `%${search}%`) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const total = (d.prepare(`SELECT COUNT(*) as c FROM documents d ${where}`).get(...vals) as any).c as number
    const rows = d.prepare(`
      SELECT d.*,
        u.id as u_id, u.name as u_name, u.email as u_email,
        u.role as u_role, u.position as u_position, u.status as u_status, u.avatar as u_avatar,
        c.id as c_id, c.name as c_name, c.code as c_code, c.color as c_color
      FROM documents d
      LEFT JOIN users               u ON d.authorId   = u.id
      LEFT JOIN document_categories c ON d.categoryId = c.id
      ${where}
      ORDER BY d.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(...vals, pageSize, (page - 1) * pageSize) as any[]

    const data = rows.map(({ u_id, u_name, u_email, u_role, u_position, u_status, u_avatar,
                              c_id, c_name, c_code, c_color, ...doc }) => ({
      ...doc,
      author:   u_id ? { id: u_id, name: u_name, email: u_email, role: u_role, position: u_position, status: u_status, avatar: u_avatar } : null,
      category: c_id ? { id: c_id, name: c_name, code: c_code, color: c_color } : null,
      tags: [],
    }))
    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } }
  })

  ipcMain.handle('db:tasks', (_e, params: any = {}) => {
    const d = getDb()
    const { status, assigneeId } = params
    const conds: string[] = []
    const vals: any[] = []
    if (status)     { conds.push('t.status = ?');     vals.push(status) }
    if (assigneeId) { conds.push('t.assigneeId = ?'); vals.push(assigneeId) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const rows = d.prepare(`
      SELECT t.*,
        a.id as a_id, a.name as a_name, a.email as a_email,
        a.role as a_role, a.position as a_position, a.status as a_status,
        cr.id as cr_id, cr.name as cr_name, cr.email as cr_email
      FROM tasks t
      LEFT JOIN users a  ON t.assigneeId = a.id
      LEFT JOIN users cr ON t.creatorId  = cr.id
      ${where}
      ORDER BY t.status ASC, t."order" ASC, t.createdAt DESC
    `).all(...vals) as any[]

    const ids = rows.map(r => r.id)
    const subtasksMap: Record<string, any[]> = {}
    if (ids.length > 0) {
      const ph = ids.map(() => '?').join(',')
      const subs = d.prepare(`SELECT * FROM subtasks WHERE taskId IN (${ph}) ORDER BY "order" ASC`).all(...ids) as any[]
      for (const s of subs) {
        ;(subtasksMap[s.taskId] ??= []).push(s)
      }
    }

    return rows.map(({ a_id, a_name, a_email, a_role, a_position, a_status,
                       cr_id, cr_name, cr_email, ...task }) => ({
      ...task,
      assignee: a_id  ? { id: a_id,  name: a_name,  email: a_email,  role: a_role,  position: a_position, status: a_status } : null,
      creator:  cr_id ? { id: cr_id, name: cr_name, email: cr_email } : null,
      subtasks: subtasksMap[task.id] ?? [],
      tags: [],
    }))
  })

  ipcMain.handle('db:activity', (_e, params: any = {}) => {
    const d = getDb()
    const limit  = params?.limit  ?? 10
    const offset = params?.offset ?? 0
    const rows = d.prepare(`
      SELECT al.*,
        u.id as u_id, u.name as u_name, u.email as u_email,
        u.role as u_role, u.position as u_position, u.status as u_status, u.avatar as u_avatar,
        doc.id as d_id, doc.number as d_number, doc.title as d_title, doc.status as d_status,
        t.id as t_id, t.title as t_title, t.status as t_status
      FROM activity_log al
      LEFT JOIN users     u   ON al.userId     = u.id
      LEFT JOIN documents doc ON al.documentId = doc.id
      LEFT JOIN tasks     t   ON al.taskId     = t.id
      ORDER BY al.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[]

    return rows.map(({ u_id, u_name, u_email, u_role, u_position, u_status, u_avatar,
                       d_id, d_number, d_title, d_status,
                       t_id, t_title, t_status, ...al }) => ({
      ...al,
      user:     u_id ? { id: u_id, name: u_name, email: u_email, role: u_role, position: u_position, status: u_status, avatar: u_avatar } : null,
      document: d_id ? { id: d_id, number: d_number, title: d_title, status: d_status } : null,
      task:     t_id ? { id: t_id, title: t_title, status: t_status } : null,
    }))
  })

  ipcMain.handle('db:team', () => {
    const d = getDb()
    const users = d.prepare(`SELECT * FROM users ORDER BY role ASC`).all() as any[]
    const tasks = d.prepare(`SELECT * FROM tasks WHERE status != 'CANCELLED' ORDER BY "order" ASC`).all() as any[]
    const byUser: Record<string, any[]> = {}
    for (const t of tasks) (byUser[t.assigneeId] ??= []).push(t)
    return users.map(u => ({ ...u, assignedTasks: byUser[u.id] ?? [] }))
  })

  ipcMain.handle('db:team:member', (_e, id: string) => {
    const d = getDb()
    const user = d.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as any
    if (!user) return null

    const taskRows = d.prepare(`
      SELECT t.*, a.id as a_id, a.name as a_name
      FROM tasks t
      LEFT JOIN users a ON t.assigneeId = a.id
      WHERE t.assigneeId = ?
      ORDER BY t.createdAt DESC
    `).all(id) as any[]

    const documents = d.prepare(
      `SELECT * FROM documents WHERE authorId = ? ORDER BY createdAt DESC LIMIT 10`
    ).all(id) as any[]

    return {
      ...user,
      assignedTasks: taskRows.map(({ a_id, a_name, ...task }: any) => ({
        ...task,
        assignee: a_id ? { id: a_id, name: a_name } : null,
      })),
      documents,
    }
  })
}

// ─── Main window ──────────────────────────────────────────────────────────────
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
      backgroundThrottling: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    splashWindow?.close()
    splashWindow = null
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('app://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── IPC: window controls ─────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Register protocol first
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    const staticDir = getStaticDir()
    let pathname = decodeURIComponent(url.pathname)
    const filePath = /\.[^/]+$/.test(pathname)
      ? path.join(staticDir, pathname)
      : path.join(staticDir, pathname, 'index.html')
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // 1. Show splash IMMEDIATELY – before any heavy work
  createSplash()

  // 2. IPC handlers registered before DB so any early renderer calls are safe
  registerIpcHandlers()

  // 3. Start creating main window in parallel with DB init
  createMainWindow()

  // 4. Init DB (synchronous, happens while splash is visible)
  const userDataDir = app.getPath('userData')
  databasePath = path.join(userDataDir, 'nexus.db')
  try {
    initDatabase(databasePath)
    db = new Database(databasePath, { readonly: false, fileMustExist: false })
    db.pragma('journal_mode = WAL')   // WAL mode = faster concurrent reads
    db.pragma('synchronous = NORMAL') // safe + faster than FULL
    db.pragma('cache_size = -8000')   // 8 MB page cache
    db.pragma('temp_store = MEMORY')  // temp tables in RAM
  } catch (err: any) {
    console.error('Ошибка инициализации БД:', err)
  }

  // 5. Load the app
  mainWindow?.loadURL('app://localhost/dashboard')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      mainWindow?.loadURL('app://localhost/dashboard')
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  db?.close()
})
