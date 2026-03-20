'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { Select } from '@/app/components/ui/Select'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { Avatar } from '@/app/components/ui/Avatar'
import { DocumentDrawer } from '@/app/components/documents/DocumentDrawer'
import { MOCK_DOCUMENTS, MOCK_USERS } from '@/app/lib/mock-data'
import { formatDate } from '@/app/lib/utils'
import { PRIORITY_COLORS, DOCUMENT_STATUS_LABELS, PRIORITY_LABELS } from '@/app/lib/constants'
import type { Document, DocumentStatus, Priority } from '@/app/types'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  ...Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Все приоритеты' },
  ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
]

const AUTHOR_OPTIONS = [
  { value: '', label: 'Все авторы' },
  ...MOCK_USERS.map(u => ({ value: u.id, label: u.name })),
]

type SortKey = 'number' | 'title' | 'status' | 'priority' | 'createdAt' | 'author'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null
  return dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)

  const filtered = useMemo(() => {
    let result = [...documents]
    const q = search.toLowerCase()
    if (q) result = result.filter(d => d.title.toLowerCase().includes(q) || d.number.toLowerCase().includes(q))
    if (statusFilter) result = result.filter(d => d.status === statusFilter)
    if (priorityFilter) result = result.filter(d => d.priority === priorityFilter)
    if (authorFilter) result = result.filter(d => d.authorId === authorFilter)

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
  }, [documents, search, statusFilter, priorityFilter, authorFilter, sortKey, sortDir])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleStatusChange = (docId: string, status: Document['status']) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status } : d))
  }

  const COLUMNS: { key: SortKey | null; label: string; width?: number }[] = [
    { key: 'priority', label: '!', width: 40 },
    { key: 'number', label: '№', width: 80 },
    { key: 'title', label: 'Название' },
    { key: 'author', label: 'Автор', width: 160 },
    { key: null, label: 'Категория', width: 120 },
    { key: 'createdAt', label: 'Дата', width: 80 },
    { key: 'status', label: 'Статус', width: 120 },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
          Документы
        </h1>
        <Button variant="primary" size="md">
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
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1) }} options={STATUS_OPTIONS} placeholder="Все статусы" />
        <Select value={priorityFilter} onChange={v => { setPriorityFilter(v); setPage(1) }} options={PRIORITY_OPTIONS} placeholder="Все приоритеты" />
        <Select value={authorFilter} onChange={v => { setAuthorFilter(v); setPage(1) }} options={AUTHOR_OPTIONS} placeholder="Все авторы" />
        <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          {filtered.length} документов
        </span>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Table header */}
        <div
          className="flex items-center px-4"
          style={{
            height: 40,
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-elevated)',
          }}
        >
          {COLUMNS.map(({ key, label, width }) => (
            <div
              key={label}
              className={`flex items-center gap-1 font-mono uppercase tracking-wide select-none ${key ? 'cursor-pointer hover:text-[var(--color-text-secondary)]' : ''}`}
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.08em',
                flex: width ? undefined : 1,
                width: width,
                minWidth: width,
                flexShrink: width ? 0 : undefined,
              }}
              onClick={() => key && handleSort(key)}
            >
              {label}
              {key && <SortIcon active={sortKey === key} dir={sortDir} />}
            </div>
          ))}
        </div>

        {/* Rows */}
        {paginated.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center px-4 cursor-pointer transition-all duration-150"
            style={{
              height: 48,
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            onClick={() => setSelectedDoc(doc)}
          >
            {/* Priority */}
            <div style={{ width: 40, minWidth: 40, flexShrink: 0 }}>
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: PRIORITY_COLORS[doc.priority],
                  display: 'block',
                }}
              />
            </div>
            {/* Number */}
            <div style={{ width: 80, minWidth: 80, flexShrink: 0 }}>
              <span className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--color-accent)' }}>
                {doc.number}
              </span>
            </div>
            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                className="font-sans block truncate"
                style={{ fontSize: 13, color: 'var(--color-text)' }}
              >
                {doc.title}
              </span>
            </div>
            {/* Author */}
            <div style={{ width: 160, minWidth: 160, flexShrink: 0 }}>
              <div className="flex items-center gap-2">
                <Avatar name={doc.author.name} size={20} />
                <span
                  className="font-sans truncate"
                  style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}
                >
                  {doc.author.name}
                </span>
              </div>
            </div>
            {/* Category */}
            <div style={{ width: 120, minWidth: 120, flexShrink: 0 }}>
              {doc.category && (
                <div className="flex items-center gap-1.5">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: doc.category.color, display: 'block' }} />
                  <span className="font-sans truncate" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {doc.category.code}
                  </span>
                </div>
              )}
            </div>
            {/* Date */}
            <div style={{ width: 80, minWidth: 80, flexShrink: 0 }}>
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {formatDate(doc.createdAt, 'dd.MM.yy')}
              </span>
            </div>
            {/* Status */}
            <div style={{ width: 120, minWidth: 120, flexShrink: 0 }}>
              <StatusBadge type="document" status={doc.status} />
            </div>
          </div>
        ))}

        {paginated.length === 0 && (
          <div className="py-16 text-center font-sans text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Документы не найдены
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
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Назад
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Вперёд
            </Button>
          </div>
        </div>
      )}

      {/* Document Drawer */}
      <DocumentDrawer
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
