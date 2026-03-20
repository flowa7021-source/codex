import Database from 'better-sqlite3'
import path from 'path'
import bcrypt from 'bcryptjs'

// ─── Schema DDL ───────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           TEXT    PRIMARY KEY,
  email        TEXT    UNIQUE NOT NULL,
  passwordHash TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  role         TEXT    NOT NULL DEFAULT 'SPECIALIST',
  position     TEXT    NOT NULL,
  avatar       TEXT,
  status       TEXT    NOT NULL DEFAULT 'OFFLINE',
  lastSeenAt   TEXT,
  createdAt    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS document_categories (
  id    TEXT PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  code  TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#D4A054'
);

CREATE TABLE IF NOT EXISTS documents (
  id          TEXT    PRIMARY KEY,
  number      TEXT    UNIQUE NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT,
  status      TEXT    NOT NULL DEFAULT 'DRAFT',
  priority    TEXT    NOT NULL DEFAULT 'MEDIUM',
  version     INTEGER NOT NULL DEFAULT 1,
  filePath    TEXT,
  fileSize    INTEGER,
  authorId    TEXT    NOT NULL,
  categoryId  TEXT,
  createdAt   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  dueDate     TEXT,
  FOREIGN KEY (authorId)   REFERENCES users(id),
  FOREIGN KEY (categoryId) REFERENCES document_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_documents_status   ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_authorId ON documents(authorId);
CREATE INDEX IF NOT EXISTS idx_documents_priority ON documents(priority);

CREATE TABLE IF NOT EXISTS document_versions (
  id          TEXT    PRIMARY KEY,
  version     INTEGER NOT NULL,
  filePath    TEXT    NOT NULL,
  fileSize    INTEGER,
  changelog   TEXT,
  createdAt   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  documentId  TEXT    NOT NULL,
  createdById TEXT    NOT NULL,
  FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (documentId, version)
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT    PRIMARY KEY,
  title       TEXT    NOT NULL,
  description TEXT,
  status      TEXT    NOT NULL DEFAULT 'TODO',
  priority    TEXT    NOT NULL DEFAULT 'MEDIUM',
  "order"     INTEGER NOT NULL DEFAULT 0,
  dueDate     TEXT,
  assigneeId  TEXT,
  creatorId   TEXT    NOT NULL,
  documentId  TEXT,
  createdAt   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completedAt TEXT,
  FOREIGN KEY (assigneeId) REFERENCES users(id),
  FOREIGN KEY (creatorId)  REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigneeId ON tasks(assigneeId);
CREATE INDEX IF NOT EXISTS idx_tasks_dueDate    ON tasks(dueDate);

CREATE TABLE IF NOT EXISTS subtasks (
  id        TEXT    PRIMARY KEY,
  title     TEXT    NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  "order"   INTEGER NOT NULL DEFAULT 0,
  taskId    TEXT    NOT NULL,
  FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  createdAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  authorId   TEXT NOT NULL,
  documentId TEXT,
  taskId     TEXT,
  parentId   TEXT,
  FOREIGN KEY (authorId)   REFERENCES users(id),
  FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (taskId)     REFERENCES tasks(id)     ON DELETE CASCADE,
  FOREIGN KEY (parentId)   REFERENCES comments(id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id         TEXT PRIMARY KEY,
  decision   TEXT NOT NULL,
  comment    TEXT,
  createdAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  userId     TEXT NOT NULL,
  documentId TEXT NOT NULL,
  FOREIGN KEY (userId)     REFERENCES users(id),
  FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (userId, documentId)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id         TEXT PRIMARY KEY,
  action     TEXT NOT NULL,
  details    TEXT,
  createdAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  userId     TEXT NOT NULL,
  documentId TEXT,
  taskId     TEXT,
  FOREIGN KEY (userId)     REFERENCES users(id),
  FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE SET NULL,
  FOREIGN KEY (taskId)     REFERENCES tasks(id)     ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_createdAt ON activity_log(createdAt);
CREATE INDEX IF NOT EXISTS idx_activity_userId    ON activity_log(userId);

CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#D4A054'
);

CREATE TABLE IF NOT EXISTS tags_on_documents (
  documentId TEXT NOT NULL,
  tagId      TEXT NOT NULL,
  PRIMARY KEY (documentId, tagId),
  FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tagId)      REFERENCES tags(id)      ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags_on_tasks (
  taskId TEXT NOT NULL,
  tagId  TEXT NOT NULL,
  PRIMARY KEY (taskId, tagId),
  FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tagId)  REFERENCES tags(id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id                 TEXT    PRIMARY KEY,
  date               TEXT    NOT NULL,
  documentsCreated   INTEGER NOT NULL DEFAULT 0,
  documentsCompleted INTEGER NOT NULL DEFAULT 0,
  tasksCreated       INTEGER NOT NULL DEFAULT 0,
  tasksCompleted     INTEGER NOT NULL DEFAULT 0,
  avgProcessingHours REAL,
  activeUsers        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (date)
);
`

// ─── Seed data ────────────────────────────────────────────────────────────────

function cuid(n: number): string {
  return `seed-${String(n).padStart(3, '0')}`
}

function seedDatabase(db: Database.Database): void {
  const adminHash = bcrypt.hashSync('admin', 10)

  const now = new Date().toISOString()
  const d = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString()

  // Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, passwordHash, name, role, position, status, createdAt, updatedAt)
    VALUES (@id, @email, @passwordHash, @name, @role, @position, @status, @createdAt, @updatedAt)
  `)

  const users = [
    { id: cuid(1), email: 'salakhutdinov@umit.ru', passwordHash: adminHash, name: 'Салахутдинов М.М.', role: 'MANAGER',    position: 'Начальник УМиТ',                       status: 'ONLINE',  createdAt: d(-80), updatedAt: now },
    { id: cuid(2), email: 'kozlova@umit.ru',        passwordHash: adminHash, name: 'Козлова Е.Н.',       role: 'LEAD',       position: 'Ведущий инженер',                       status: 'ONLINE',  createdAt: d(-75), updatedAt: now },
    { id: cuid(3), email: 'petrov@umit.ru',          passwordHash: adminHash, name: 'Петров А.С.',         role: 'SPECIALIST', position: 'Инженер по ТО',                         status: 'AWAY',    createdAt: d(-40), updatedAt: now },
    { id: cuid(4), email: 'ivanova@umit.ru',         passwordHash: adminHash, name: 'Иванова О.В.',        role: 'SPECIALIST', position: 'Специалист по документообороту',        status: 'ONLINE',  createdAt: d(-60), updatedAt: now },
    { id: cuid(5), email: 'morozov@umit.ru',         passwordHash: adminHash, name: 'Морозов Д.И.',        role: 'LEAD',       position: 'Ведущий слесарь-ремонтник',             status: 'OFFLINE', createdAt: d(-120), updatedAt: now },
    { id: cuid(6), email: 'smirnova@umit.ru',        passwordHash: adminHash, name: 'Смирнова Т.А.',       role: 'SPECIALIST', position: 'Техник по обслуживанию',                status: 'ONLINE',  createdAt: d(-20), updatedAt: now },
  ]
  users.forEach(u => insertUser.run(u))

  // Categories
  const insertCat = db.prepare(`
    INSERT INTO document_categories (id, name, code, color) VALUES (@id, @name, @code, @color)
  `)
  const cats = [
    { id: 'cat-1', name: 'Должностные инструкции', code: 'ДИ',  color: '#60A5FA' },
    { id: 'cat-2', name: 'Акты проверок',           code: 'АП',  color: '#4ADE80' },
    { id: 'cat-3', name: 'Графики ТО',              code: 'ГТО', color: '#FBBF24' },
    { id: 'cat-4', name: 'Приказы',                 code: 'ПР',  color: '#F87171' },
    { id: 'cat-5', name: 'Справки',                 code: 'СП',  color: '#D4A054' },
  ]
  cats.forEach(c => insertCat.run(c))

  // Documents
  const insertDoc = db.prepare(`
    INSERT INTO documents (id, number, title, description, status, priority, version, authorId, categoryId, createdAt, updatedAt, dueDate)
    VALUES (@id, @number, @title, @description, @status, @priority, @version, @authorId, @categoryId, @createdAt, @updatedAt, @dueDate)
  `)
  const docs = [
    { id: 'doc-1', number: 'ДИ-047', title: 'Должностная инструкция слесаря-ремонтника', description: 'Консолидированная должностная инструкция для слесарей-ремонтников 3-5 разрядов', status: 'REVIEW',    priority: 'HIGH',   version: 3, authorId: cuid(2), categoryId: 'cat-1', createdAt: d(-10), updatedAt: d(-2),  dueDate: d(2)  },
    { id: 'doc-2', number: 'АП-031', title: 'Акт проверки технического состояния оборудования цех №3', description: 'Плановая проверка состояния оборудования за Q1 2026', status: 'APPROVED',  priority: 'MEDIUM', version: 1, authorId: cuid(3), categoryId: 'cat-2', createdAt: d(-15), updatedAt: d(-5),  dueDate: d(-5) },
    { id: 'doc-3', number: 'ГТО-012', title: 'График планово-предупредительного технического обслуживания', description: 'Годовой график ТО на 2026 год', status: 'ACTIVE',   priority: 'URGENT', version: 2, authorId: cuid(1), categoryId: 'cat-3', createdAt: d(-65), updatedAt: d(-19), dueDate: d(12) },
    { id: 'doc-4', number: 'ПР-008', title: 'Приказ об организации дежурства в праздничные дни', description: null, status: 'DRAFT',    priority: 'LOW',    version: 1, authorId: cuid(1), categoryId: 'cat-4', createdAt: d(-3),  updatedAt: d(-1),  dueDate: d(7)  },
    { id: 'doc-5', number: 'СП-019', title: 'Справка о наличии оборудования на складе ЗИП', description: 'Складской учёт ЗИП по итогам инвентаризации', status: 'ACTIVE',   priority: 'MEDIUM', version: 1, authorId: cuid(4), categoryId: 'cat-5', createdAt: d(-7),  updatedAt: d(-3),  dueDate: null  },
  ]
  docs.forEach(d => insertDoc.run(d))

  // Tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, "order", assigneeId, creatorId, createdAt, updatedAt, dueDate)
    VALUES (@id, @title, @description, @status, @priority, @order, @assigneeId, @creatorId, @createdAt, @updatedAt, @dueDate)
  `)
  const tasks = [
    { id: 'tsk-1', title: 'Обновить должностные инструкции слесарей',          description: 'Привести в соответствие с актуальными требованиями ЕТКС',    status: 'ACTIVE',   priority: 'HIGH',   order: 0, assigneeId: cuid(2), creatorId: cuid(1), createdAt: d(-5),  updatedAt: now,   dueDate: d(3)  },
    { id: 'tsk-2', title: 'Провести инвентаризацию ЗИП на складе',              description: null,                                                           status: 'TODO',     priority: 'MEDIUM', order: 1, assigneeId: cuid(4), creatorId: cuid(1), createdAt: d(-3),  updatedAt: now,   dueDate: d(7)  },
    { id: 'tsk-3', title: 'Согласовать график ТО с цехами',                     description: 'Получить подписи руководителей цехов 1, 2 и 3',               status: 'PENDING',  priority: 'URGENT', order: 0, assigneeId: cuid(1), creatorId: cuid(1), createdAt: d(-8),  updatedAt: now,   dueDate: d(1)  },
    { id: 'tsk-4', title: 'Подготовить отчёт по ТО за март',                    description: null,                                                           status: 'TODO',     priority: 'MEDIUM', order: 2, assigneeId: cuid(3), creatorId: cuid(2), createdAt: d(-2),  updatedAt: now,   dueDate: d(11) },
    { id: 'tsk-5', title: 'Закрыть замечания по акту проверки цех №3',          description: 'Устранить 4 несоответствия, выявленных при плановой проверке', status: 'REVIEW',   priority: 'HIGH',   order: 0, assigneeId: cuid(3), creatorId: cuid(2), createdAt: d(-12), updatedAt: now,   dueDate: d(2)  },
    { id: 'tsk-6', title: 'Обучение по охране труда (новые сотрудники)',         description: null,                                                           status: 'DONE',     priority: 'MEDIUM', order: 0, assigneeId: cuid(6), creatorId: cuid(1), createdAt: d(-20), updatedAt: d(-1), dueDate: d(-1) },
  ]
  tasks.forEach(t => insertTask.run(t))

  // Activity log
  const insertActivity = db.prepare(`
    INSERT INTO activity_log (id, action, details, userId, documentId, taskId, createdAt)
    VALUES (@id, @action, @details, @userId, @documentId, @taskId, @createdAt)
  `)
  const activities = [
    { id: 'act-1', action: 'DOCUMENT_CREATED',  details: 'Создан документ ДИ-047',                  userId: cuid(2), documentId: 'doc-1', taskId: null, createdAt: d(-10) },
    { id: 'act-2', action: 'DOCUMENT_APPROVED', details: 'Документ АП-031 согласован',               userId: cuid(1), documentId: 'doc-2', taskId: null, createdAt: d(-5)  },
    { id: 'act-3', action: 'TASK_CREATED',       details: 'Создана задача: обновить инструкции',      userId: cuid(1), documentId: null,    taskId: 'tsk-1', createdAt: d(-5) },
    { id: 'act-4', action: 'DOCUMENT_UPDATED',  details: 'Документ ГТО-012 переведён в статус ACTIVE', userId: cuid(1), documentId: 'doc-3', taskId: null, createdAt: d(-3) },
    { id: 'act-5', action: 'TASK_STATUS',        details: 'Задача «Обучение по ОТ» завершена',        userId: cuid(6), documentId: null,    taskId: 'tsk-6', createdAt: d(-1) },
    { id: 'act-6', action: 'DOCUMENT_CREATED',  details: 'Создан документ СП-019',                   userId: cuid(4), documentId: 'doc-5', taskId: null, createdAt: d(-7) },
  ]
  activities.forEach(a => insertActivity.run(a))

  // Daily metrics (last 7 days)
  const insertMetric = db.prepare(`
    INSERT INTO daily_metrics (id, date, documentsCreated, documentsCompleted, tasksCreated, tasksCompleted, activeUsers)
    VALUES (@id, @date, @documentsCreated, @documentsCompleted, @tasksCreated, @tasksCompleted, @activeUsers)
  `)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000)
    date.setUTCHours(0, 0, 0, 0)
    insertMetric.run({
      id: `metric-${i}`,
      date: date.toISOString(),
      documentsCreated:   Math.floor(Math.random() * 4),
      documentsCompleted: Math.floor(Math.random() * 3),
      tasksCreated:       Math.floor(Math.random() * 6),
      tasksCompleted:     Math.floor(Math.random() * 4),
      activeUsers:        2 + Math.floor(Math.random() * 4),
    })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initDatabase(dbPath: string): void {
  const db = new Database(dbPath)
  try {
    db.exec(SCHEMA_SQL)
    const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
    if (count === 0) {
      seedDatabase(db)
    }
  } finally {
    db.close()
  }
}
