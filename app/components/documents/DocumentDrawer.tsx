'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Check, RotateCcw, MessageSquare, GitBranch, CheckCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Document } from '@/app/types'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { Button } from '@/app/components/ui/Button'
import { Avatar } from '@/app/components/ui/Avatar'
import { formatDate } from '@/app/lib/utils'
import { MOCK_USERS } from '@/app/lib/mock-data'

interface DocumentDrawerProps {
  document: Document | null
  onClose: () => void
  onStatusChange?: (docId: string, status: Document['status']) => void
  onDelete?: (docId: string) => void
}

type Tab = 'overview' | 'versions' | 'comments' | 'approvals'

export function DocumentDrawer({ document: doc, onClose, onStatusChange, onDelete }: DocumentDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [approveComment, setApproveComment] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = () => {
    if (!doc) return
    onDelete?.(doc.id)
    toast.success(`Документ ${doc.number} удалён`)
    onClose()
  }

  const handleApprove = () => {
    if (!doc) return
    onStatusChange?.(doc.id, 'APPROVED')
    toast.success(`Документ ${doc.number} утверждён`)
    onClose()
  }

  const handleReject = () => {
    if (!doc) return
    if (!approveComment.trim()) {
      toast.error('Введите причину возврата')
      return
    }
    onStatusChange?.(doc.id, 'ACTIVE')
    toast.info(`Документ ${doc.number} возвращён на доработку`)
    setShowRejectForm(false)
    onClose()
  }

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'overview', label: 'Обзор', icon: MessageSquare },
    { id: 'versions', label: 'Версии', icon: GitBranch },
    { id: 'comments', label: 'Комментарии', icon: MessageSquare },
    { id: 'approvals', label: 'Согласования', icon: CheckCircle },
  ]

  const mockApprovals = MOCK_USERS.slice(0, 3).map((u, i) => ({
    user: u,
    decision: i === 0 ? 'APPROVED' : i === 1 ? 'APPROVED' : 'pending',
  }))

  const mockVersions = [
    { version: 1, date: new Date('2026-03-10'), changelog: 'Первоначальная версия', size: 45678 },
    { version: 2, date: new Date('2026-03-15'), changelog: 'Исправлены разделы 2–4', size: 48920 },
    { version: 3, date: new Date('2026-03-18'), changelog: 'Финальная редакция', size: 51200 },
  ]

  return (
    <AnimatePresence>
      {doc && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{
              width: 420,
              background: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between p-5"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div>
                <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Документ #{doc.number}
                </p>
                <h2
                  className="font-sans font-semibold mt-1"
                  style={{ fontSize: 18, lineHeight: 1.4, color: 'var(--color-text)' }}
                >
                  {doc.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md transition-all duration-200 flex-shrink-0 ml-3"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Meta */}
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Статус', value: <StatusBadge type="document" status={doc.status} /> },
                  { label: 'Приоритет', value: <StatusBadge type="priority" status={doc.priority} /> },
                  { label: 'Автор', value: (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={doc.author.name} size={18} />
                      <span style={{ fontSize: 12 }}>{doc.author.name}</span>
                    </div>
                  )},
                  { label: 'Создан', value: <span style={{ fontSize: 12 }}>{formatDate(doc.createdAt)}</span> },
                  { label: 'Версия', value: <span style={{ fontSize: 12 }}>v{doc.version}</span> },
                  { label: 'Срок', value: <span style={{ fontSize: 12 }}>{doc.dueDate ? formatDate(doc.dueDate) : '—'}</span> },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      {label}
                    </div>
                    <div style={{ color: 'var(--color-text)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div
              className="flex"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="flex-1 py-2.5 font-mono text-xs transition-all duration-200"
                  style={{
                    fontSize: 12,
                    color: activeTab === id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    borderBottom: activeTab === id ? '2px solid var(--color-accent)' : '2px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {doc.description && (
                    <div>
                      <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>Описание</p>
                      <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                        {doc.description}
                      </p>
                    </div>
                  )}
                  {doc.category && (
                    <div>
                      <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>Категория</p>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-xs"
                        style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: doc.category.color, display: 'inline-block' }} />
                        {doc.category.name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'versions' && (
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-px" style={{ background: 'var(--color-border)' }} />
                  <div className="space-y-4 pl-8">
                    {mockVersions.map((v) => (
                      <div key={v.version} className="relative">
                        <div
                          className="absolute -left-5 top-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: v.version === doc.version ? 'var(--color-accent)' : 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                        >
                          {v.version === doc.version && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0C0C0E', display: 'block' }} />}
                        </div>
                        <div
                          className="p-3 rounded-lg cursor-pointer transition-all"
                          style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)/40'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-semibold" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                              v{v.version}
                            </span>
                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                              {formatDate(v.date)}
                            </span>
                          </div>
                          <p className="font-sans" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            {v.changelog}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar name="Козлова Е.Н." size={24} />
                      <span className="font-sans font-medium" style={{ fontSize: 12, color: 'var(--color-text)' }}>Козлова Е.Н.</span>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>18.03.2026</span>
                    </div>
                    <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Обновила раздел 4 согласно замечаниям. Готово к финальному согласованию.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar name="Салахутдинов М.М." size={24} />
                      <span className="font-sans font-medium" style={{ fontSize: 12, color: 'var(--color-text)' }}>Салахутдинов М.М.</span>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>16.03.2026</span>
                    </div>
                    <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Раздел 4 требует уточнения квалификационных требований.
                    </p>
                  </div>
                  {/* New comment */}
                  <div
                    className="rounded-lg p-3"
                    style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                  >
                    <textarea
                      placeholder="Написать комментарий..."
                      className="w-full bg-transparent outline-none font-sans text-xs resize-none"
                      style={{ color: 'var(--color-text)', minHeight: 60, fontSize: 13 }}
                    />
                    <div className="flex justify-end mt-2">
                      <Button variant="primary" size="sm">Отправить</Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'approvals' && (
                <div className="space-y-2">
                  {mockApprovals.map(({ user, decision }) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                    >
                      <Avatar name={user.name} size={32} />
                      <div className="flex-1">
                        <div className="font-sans" style={{ fontSize: 13, color: 'var(--color-text)' }}>{user.name}</div>
                        <div className="font-sans" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{user.position}</div>
                      </div>
                      <span
                        className="font-mono text-xs px-2 py-1 rounded-md"
                        style={{
                          background: decision === 'APPROVED' ? 'var(--color-success-dim)' : decision === 'REJECTED' ? 'var(--color-danger-dim)' : 'var(--color-surface)',
                          color: decision === 'APPROVED' ? 'var(--color-success)' : decision === 'REJECTED' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                          fontSize: 11,
                        }}
                      >
                        {decision === 'APPROVED' ? '✓ Согласовано' : decision === 'REJECTED' ? '✗ Отклонено' : '○ Ожидание'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!showRejectForm ? (
              <div
                className="flex gap-2 p-4"
                style={{ borderTop: '1px solid var(--color-border)' }}
              >
                {doc.status === 'REVIEW' && (
                  <>
                    <Button variant="primary" className="flex-1" onClick={handleApprove}>
                      <Check size={14} />
                      Утвердить
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={() => setShowRejectForm(true)}>
                      <RotateCcw size={14} />
                      На доработку
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="md" onClick={() => toast.info('Функция скачивания в разработке')}>
                  <Download size={14} />
                </Button>
                {onDelete && !confirmDelete && (
                  <Button variant="ghost" size="md" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} />
                  </Button>
                )}
                {confirmDelete && (
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold"
                      style={{ background: 'var(--color-danger)', color: '#fff', fontSize: 12 }}
                    >
                      Удалить
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg font-mono text-xs"
                      style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)', fontSize: 12 }}
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="font-mono text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Причина возврата
                </p>
                <textarea
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder="Укажите причину возврата на доработку..."
                  className="w-full rounded-lg p-3 font-sans text-xs outline-none resize-none"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    minHeight: 80,
                    fontSize: 13,
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <Button variant="danger" size="sm" onClick={handleReject}>Отправить</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowRejectForm(false)}>Отмена</Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
