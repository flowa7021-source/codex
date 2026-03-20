import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import Database from 'better-sqlite3'
import { initDatabase } from './db-init'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let databasePath = ''
let db: Database.Database | null = null

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
// Must be called before app is ready.
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
    width: 56px; height: 56px; border-radius: 12px;
    background: linear-gradient(135deg, #D4A054, rgba(212,160,84,0.5));
    display: flex; align-items: center; justify-content: center;
    font-family: 'Courier New', monospace;
    font-size: 28px; font-weight: 700; color: #0C0C0E;
  }
  h1 { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; letter-spacing: 0.15em; color: #E8E6E1; }
  .subtitle { font-size: 11px; color: #55555F; letter-spacing: 0.05em; margin-top: -12px; }
  .spinner { width: 28px; height: 28px; border: 2px solid #2A2A35; border-top-color: #D4A054; border-radius: 50%; animation: spin 0.8s linear infinite; margin-top: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status { font-size: 12px; color: #8A8A95; letter-spacing: 0.03em; }
</style>
</head>
<body>
  <div class="logo">N</div>
  <h1>NEXUS</h1>
  <p class="subtitle">Command Center</p>
  <div class="spinner"></div>
  <p class="status">Инициализация...</p>
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
  // ── Metrics overview ──────────────────────────────────────────────────────
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

  // ── Metrics weekly ────────────────────────────────────────────────────────
  ipcMain.handle('db:metrics:weekly', () => {
    const rows = getDb()
      .prepare(`SELECT tasksCompleted, documentsCompleted FROM daily_metrics ORDER BY date ASC LIMIT 7`)
      .all() as any[]
    return rows.map(r => r.tasksCompleted + r.documentsCompleted)
  })

  // ── Documents ─────────────────────────────────────────────────────────────
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
        u.id  as u_id,  u.name  as u_name,  u.email as u_email,
        u.role as u_role, u.position as u_position, u.status as u_status, u.avatar as u_avatar,
        c.id  as c_id,  c.name  as c_name,  c.code  as c_code,  c.color as c_color
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

  // ── Tasks ─────────────────────────────────────────────────────────────────
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
        a.id  as a_id,  a.name  as a_name,  a.email as a_email,
        a.role as a_role, a.position as a_position, a.status as a_status,
        cr.id as cr_id, cr.name as cr_name, cr.email as cr_email
      FROM tasks t
      LEFT JOIN users a  ON t.assigneeId = a.id
      LEFT JOIN users cr ON t.creatorId  = cr.id
      ${where}
      ORDER BY t.status ASC, t."order" ASC, t.createdAt DESC
    `).all(...vals) as any[]

    // Batch-fetch subtasks
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

  // ── Activity log ──────────────────────────────────────────────────────────
  ipcMain.handle('db:activity', (_e, params: any = {}) => {
    const d = getDb()
    const limit  = params?.limit  ?? 10
    const offset = params?.offset ?? 0
    const rows = d.prepare(`
      SELECT al.*,
        u.id  as u_id,  u.name  as u_name,  u.email as u_email,
        u.role as u_role, u.position as u_position, u.status as u_status, u.avatar as u_avatar,
        doc.id as d_id, doc.number as d_number, doc.title as d_title, doc.status as d_status,
        t.id   as t_id, t.title  as t_title,  t.status as t_status
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

  // ── Team list ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:team', () => {
    const d = getDb()
    const users = d.prepare(`SELECT * FROM users ORDER BY role ASC`).all() as any[]
    const tasks = d.prepare(`SELECT * FROM tasks WHERE status != 'CANCELLED' ORDER BY "order" ASC`).all() as any[]
    const byUser: Record<string, any[]> = {}
    for (const t of tasks) (byUser[t.assigneeId] ??= []).push(t)
    return users.map(u => ({ ...u, assignedTasks: byUser[u.id] ?? [] }))
  })

  // ── Team member detail ────────────────────────────────────────────────────
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
  // Register protocol handler to serve Next.js static export files
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    const staticDir = getStaticDir()
    let pathname = decodeURIComponent(url.pathname)

    // Files with extensions (JS, CSS, images, fonts) → serve directly
    const filePath = /\.[^/]+$/.test(pathname)
      ? path.join(staticDir, pathname)
      : path.join(staticDir, pathname, 'index.html')  // trailingSlash: true

    return net.fetch(pathToFileURL(filePath).toString())
  })

  // Init DB
  const userDataDir = app.getPath('userData')
  databasePath = path.join(userDataDir, 'nexus.db')
  try {
    initDatabase(databasePath)
    db = new Database(databasePath)
  } catch (err: any) {
    console.error('Ошибка инициализации БД:', err)
  }

  registerIpcHandlers()
  createSplash()
  createMainWindow()
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
