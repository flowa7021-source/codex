'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { Select } from '@/app/components/ui/Select'
import { DocumentDrawer } from '@/app/components/documents/DocumentDrawer'
import { MOCK_USERS, MOCK_CATEGORIES } from '@/app/lib/mock-data'
import { formatDate, generateDocNumber } from '@/app/lib/utils'
import {
  PRIORITY_COLORS, PRIORITY_LABELS, DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS,
} from '@/app/lib/constants'
import type { Document, DocumentStatus, Priority } from '@/app/types'

const CURRENT_USER = MOCK_USERS[0]
const PAGE_SIZE = 20
const ALL_DOC_STATUSES: DocumentStatus[] = ['DRAFT', 'ACTIVE', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']
const ALL_PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

function parseDates(raw: unknown): Document[] {
  return (raw as Document[]).map(d => ({
    ...d,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
    dueDate: d.dueDate ? new Date(d.dueDate) : undefined,
  }))
}

function loadDocs(): Document[] {
  try {
    const saved = localStorage.getItem('nexus-documents')
    if (saved) return parseDates(JSON.parse(saved))
  } catch {}
  return []
}

function saveDocs(docs: Document[]) {
  try { localStorage.setItem('nexus-documents', JSON.stringify(docs)) } catch {}
}

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  ...ALL_DOC_STATUSES.map(v => ({ value: v, label: DOCUMENT_STATUS_LABELS[v] })),
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Все приоритеты' },
  ...ALL_PRIORITIES.map(v => ({ value: v, label: PRIORITY_LABELS[v] })),
]

type SortKey = 'number' | 'title' | 'status' | 'priority' | 'createdAt' | 'author'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null
  return dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

// ─── Inline status dropdown ───────────────────────────────────────────────────
function StatusCell({ value, onChange }: { value: DocumentStatus; onChange: (s: DocumentStatus) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="px-2.5 py-1 rounded-md font-mono transition-all"
        style={{
          fontSize: 11,
          background: `${DOCUMENT_STATUS_COLORS[value]}18`,
          color: DOCUMENT_STATUS_COLORS[value],
          border: `1px solid ${DOCUMENT_STATUS_COLORS[value]}40`,
        }}
      >
        {DOCUMENT_STATUS_LABELS[value]}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
              background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: 'var(--shadow-lg)', minWidth: 160, overflow: 'hidden',
            }}
          >
            {ALL_DOC_STATUSES.map(s => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left"
                style={{ background: s === value ? 'var(--color-surface-hover)' : 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = s === value ? 'var(--color-surface-hover)' : 'transparent'}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOCUMENT_STATUS_COLORS[s], display: 'block' }} />
                <span className="font-mono" style={{ fontSize: 11, color: DOCUMENT_STATUS_COLORS[s] }}>{DOCUMENT_STATUS_LABELS[s]}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Inline priority dropdown ─────────────────────────────────────────────────
function PriorityCell({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-1.5 rounded-md transition-all"
        title={PRIORITY_LABELS[value]}
        style={{ background: open ? 'var(--color-elevated)' : 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-elevated)'}
        onMouseLeave={(e) => e.currentTarget.style.background = open ? 'var(--color-elevated)' : 'transparent'}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_COLORS[value], display: 'block' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
              background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: 'var(--shadow-lg)', minWidth: 140, overflow: 'hidden',
            }}
          >
            {ALL_PRIORITIES.map(p => (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left"
                style={{ background: p === value ? 'var(--color-surface-hover)' : 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = p === value ? 'var(--color-surface-hover)' : 'transparent'}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLORS[p], display: 'block' }} />
                <span className="font-mono" style={{ fontSize: 11, color: PRIORITY_COLORS[p] }}>{PRIORITY_LABELS[p]}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── New document modal ───────────────────────────────────────────────────────
function NewDocModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: Document) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [status, setStatus] = useState<DocumentStatus>('DRAFT')
  const [categoryId, setCategoryId] = useState('')
  const [dueDate, setDueDate] = useState('')

  const selectedCategory = MOCK_CATEGORIES.find(c => c.id === categoryId)

  const handleCreate = () => {
    if (!title.trim()) return
    const cat = MOCK_CATEGORIES.find(c => c.id === categoryId)
    const number = generateDocNumber(cat?.code ?? 'ДОК', Math.floor(Math.random() * 900) + 100)
    const doc: Document = {
      id: `d-${Date.now()}`,
      number,
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      version: 1,
      authorId: CURRENT_USER.id,
      author: CURRENT_USER,
      categoryId: cat?.id ?? null,
      category: cat ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
    }
    onCreate(doc)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-xl p-6 w-[560px]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono font-bold" style={{ fontSize: 15, color: 'var(--color-text)' }}>Новый документ</h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>НАЗВАНИЕ *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название документа..."
              className="w-full px-3 py-2.5 rounded-lg font-sans outline-none"
              style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 14 }}
            />
          </div>

          <div>
            <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>ОПИСАНИЕ</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg font-sans outline-none resize-none"
              style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13 }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>КАТЕГОРИЯ</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg font-mono outline-none"
                style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, colorScheme: 'dark' }}
              >
                <option value="">— без категории</option>
                {MOCK_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>СРОК</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg font-mono outline-none"
                style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>СТАТУС</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                className="w-full px-3 py-2.5 rounded-lg font-mono outline-none"
                style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: DOCUMENT_STATUS_COLORS[status], fontSize: 12, colorScheme: 'dark' }}
              >
                {ALL_DOC_STATUSES.map(s => (
                  <option key={s} value={s}>{DOCUMENT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>ПРИОРИТЕТ</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2.5 rounded-lg font-mono outline-none"
                style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: PRIORITY_COLORS[priority], fontSize: 12, colorScheme: 'dark' }}
              >
                {ALL_PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Отмена</Button>
          <Button variant="primary" size="md" onClick={handleCreate} className="flex-1" disabled={!title.trim()}>
            Создать документ
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showNewDoc, setShowNewDoc] = useState(false)

  useEffect(() => {
    setDocuments(loadDocs())
  }, [])

  const updateDocs = (next: Document[]) => {
    setDocuments(next)
    saveDocs(next)
  }

  const handleStatusChange = (docId: string, status: DocumentStatus) => {
    updateDocs(documents.map(d => d.id === docId ? { ...d, status, updatedAt: new Date() } : d))
  }

  const handlePriorityChange = (docId: string, priority: Priority) => {
    updateDocs(documents.map(d => d.id === docId ? { ...d, priority, updatedAt: new Date() } : d))
  }

  const handleCreate = (doc: Document) => {
    updateDocs([doc, ...documents])
  }

  const filtered = useMemo(() => {
    let result = [...documents]
    const q = search.toLowerCase()
    if (q) result = result.filter(d => d.title.toLowerCase().includes(q) || d.number.toLowerCase().includes(q))
    if (statusFilter) result = result.filter(d => d.status === statusFilter)
    if (priorityFilter) result = result.filter(d => d.priority === priorityFilter)

    result.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'number') cmp = a.number.localeCompare(b.number)
      else if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortKey === 'priority') cmp = a.priority.localeCompare(b.priority)
      else if (sortKey === 'author') cmp = a.author.name.localeCompare(b.author.name)
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [documents, search, statusFilter, priorityFilter, sortKey, sortDir])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const COLUMNS: { key: SortKey | null; label: string; width?: number; flex?: boolean }[] = [
    { key: 'priority', label: '!', width: 44 },
    { key: 'number', label: '№', width: 90 },
    { key: 'title', label: 'Название', flex: true },
    { key: null, label: 'Категория', width: 110 },
    { key: 'createdAt', label: 'Дата', width: 80 },
    { key: null, label: 'Срок', width: 80 },
    { key: 'status', label: 'Статус', width: 130 },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>Документы</h1>
          {documents.length > 0 && (
            <p className="font-sans mt-0.5" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {documents.filter(d => d.status === 'ACTIVE' || d.status === 'REVIEW').length} в работе · {documents.filter(d => d.status === 'APPROVED').length} утверждено
            </p>
          )}
        </div>
        <Button variant="primary" size="md" onClick={() => setShowNewDoc(true)}>
          <Plus size={14} />
          Новый документ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            icon={Search}
            placeholder="Поиск по названию или номеру..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={STATUS_OPTIONS} placeholder="Все статусы" />
        <Select value={priorityFilter} onChange={(v) => { setPriorityFilter(v); setPage(1) }} options={PRIORITY_OPTIONS} placeholder="Все приоритеты" />
        <span className="font-mono flex-shrink-0" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'документ' : 'документов'}
        </span>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center px-4"
          style={{ height: 40, borderBottom: '1px solid var(--color-border)', background: 'var(--color-elevated)' }}
        >
          {COLUMNS.map(({ key, label, width, flex }) => (
            <div
              key={label}
              className={`flex items-center gap-1 font-mono uppercase select-none ${key ? 'cursor-pointer' : ''}`}
              style={{
                fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.09em',
                flex: flex ? 1 : undefined, width, minWidth: width, flexShrink: flex ? undefined : 0,
              }}
              onClick={() => key && handleSort(key)}
            >
              {label}
              {key && <SortIcon active={sortKey === key} dir={sortDir} />}
            </div>
          ))}
        </div>

        {/* Rows */}
        {paginated.map((doc) => {
          const isOverdue = doc.dueDate && new Date(doc.dueDate) < new Date() && !['APPROVED', 'ARCHIVED'].includes(doc.status)
          return (
            <div
              key={doc.id}
              className="flex items-center px-4 cursor-pointer transition-all duration-150"
              style={{ height: 52, borderBottom: '1px solid var(--color-border-subtle)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => setSelectedDoc(doc)}
            >
              {/* Priority */}
              <div style={{ width: 44, minWidth: 44, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <PriorityCell value={doc.priority} onChange={(p) => handlePriorityChange(doc.id, p)} />
              </div>

              {/* Number */}
              <div style={{ width: 90, minWidth: 90, flexShrink: 0 }}>
                <span className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--color-accent)' }}>
                  {doc.number}
                </span>
              </div>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="font-sans block truncate" style={{ fontSize: 13, color: 'var(--color-text)' }}>
                  {doc.title}
                </span>
                {doc.description && (
                  <span className="font-sans block truncate" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {doc.description}
                  </span>
                )}
              </div>

              {/* Category */}
              <div style={{ width: 110, minWidth: 110, flexShrink: 0 }}>
                {doc.category ? (
                  <div className="flex items-center gap-1.5">
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: doc.category.color, display: 'block' }} />
                    <span className="font-sans truncate" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{doc.category.code}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>
                )}
              </div>

              {/* Created date */}
              <div style={{ width: 80, minWidth: 80, flexShrink: 0 }}>
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {formatDate(doc.createdAt, 'dd.MM.yy')}
                </span>
              </div>

              {/* Due date */}
              <div style={{ width: 80, minWidth: 80, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <input
                  type="date"
                  value={doc.dueDate ? new Date(doc.dueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const updated = { ...doc, dueDate: e.target.value ? new Date(e.target.value) : undefined, updatedAt: new Date() }
                    updateDocs(documents.map(d => d.id === doc.id ? updated : d))
                  }}
                  className="font-mono outline-none"
                  style={{
                    fontSize: 11, background: 'transparent', border: 'none',
                    color: isOverdue ? 'var(--color-danger)' : doc.dueDate ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                    colorScheme: 'dark', cursor: 'pointer', width: '100%',
                  }}
                />
              </div>

              {/* Status */}
              <div style={{ width: 130, minWidth: 130, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <StatusCell value={doc.status} onChange={(s) => handleStatusChange(doc.id, s)} />
              </div>
            </div>
          )
        })}

        {paginated.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <p className="font-mono" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {search || statusFilter || priorityFilter ? 'Документы не найдены' : 'Документов пока нет'}
            </p>
            {!search && !statusFilter && !priorityFilter && (
              <button
                onClick={() => setShowNewDoc(true)}
                className="font-sans text-sm px-4 py-2 rounded-lg transition-all"
                style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)40', fontSize: 13 }}
              >
                + Создать первый документ
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            Страница {page} из {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Вперёд</Button>
          </div>
        </div>
      )}

      {/* Document drawer */}
      <DocumentDrawer
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onStatusChange={handleStatusChange}
      />

      {/* New document modal */}
      <AnimatePresence>
        {showNewDoc && (
          <NewDocModal onClose={() => setShowNewDoc(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </div>
  )
}
