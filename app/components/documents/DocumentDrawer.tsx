'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Check, RotateCcw, MessageSquare, GitBranch, CheckCircle, Trash2, Paperclip, Send, FileText } from 'lucide-react'
import { toast } from 'sonner'
import type { Document, Comment } from '@/app/types'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { Button } from '@/app/components/ui/Button'
import { Avatar } from '@/app/components/ui/Avatar'
import { formatDate } from '@/app/lib/utils'

interface DocumentDrawerProps {
  document: Document | null
  onClose: () => void
  onStatusChange?: (docId: string, status: Document['status']) => void
  onDelete?: (docId: string) => void
  onUpdate?: (doc: Document) => void
}

type Tab = 'overview' | 'versions' | 'comments' | 'approvals'

const CURRENT_USER_NAME = 'Крот'
const CURRENT_USER_ID = 'u1'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1048576).toFixed(1)} МБ`
}

export function DocumentDrawer({ document: doc, onClose, onStatusChange, onDelete, onUpdate }: DocumentDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [approveComment, setApproveComment] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newComment, setNewComment] = useState('')

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

  const handleDownload = () => {
    if (!doc) return
    if (doc.attachmentData && doc.attachmentName) {
      const byteChars = atob(doc.attachmentData)
      const byteArr = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
      const blob = new Blob([byteArr], { type: doc.attachmentType ?? 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = doc.attachmentName
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Загрузка: ${doc.attachmentName}`)
    } else {
      toast.info('К этому документу не прикреплён файл')
    }
  }

  const handleAddComment = () => {
    if (!doc || !newComment.trim()) return
    const comment: Comment = {
      id: `c-${Date.now()}`,
      text: newComment.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      authorId: CURRENT_USER_ID,
      author: {
        id: CURRENT_USER_ID,
        email: 'krot@nexus.ru',
        name: CURRENT_USER_NAME,
        role: 'MANAGER',
        position: 'Оперативный командир',
        status: 'ONLINE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      },
      documentId: doc.id,
    }
    const updated: Document = {
      ...doc,
      comments: [...(doc.comments ?? []), comment],
      updatedAt: new Date(),
    }
    onUpdate?.(updated)
    setNewComment('')
  }

  const docVersions = (() => {
    const versions: { version: number; date: Date; changelog: string; size?: number | null }[] = [
      { version: 1, date: doc?.createdAt ?? new Date(), changelog: 'Создание документа', size: doc?.attachmentSize },
    ]
    if (doc && doc.updatedAt > doc.createdAt) {
      versions.push({ version: doc.version, date: doc.updatedAt, changelog: 'Последнее обновление', size: doc.attachmentSize })
    }
    return versions
  })()

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'overview', label: 'Обзор', icon: MessageSquare },
    { id: 'versions', label: 'Версии', icon: GitBranch },
    { id: 'comments', label: `Комментарии${doc?.comments?.length ? ` (${doc.comments.length})` : ''}`, icon: MessageSquare },
    { id: 'approvals', label: 'Согласования', icon: CheckCircle },
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
              <div className="flex-1 min-w-0 mr-3">
                <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Документ #{doc.number}
                </p>
                <h2
                  className="font-sans font-semibold mt-1"
                  style={{ fontSize: 18, lineHeight: 1.4, color: 'var(--color-text)' }}
                >
                  {doc.title}
                </h2>
                {doc.attachmentName && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Paperclip size={11} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                    <span className="font-mono truncate" style={{ fontSize: 11, color: 'var(--color-accent)' }}>
                      {doc.attachmentName}
                    </span>
                    {doc.attachmentSize && (
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        {formatFileSize(doc.attachmentSize)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md transition-all duration-200 flex-shrink-0"
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
            <div className="flex" style={{ borderBottom: '1px solid var(--color-border)' }}>
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="flex-1 py-2.5 font-mono text-xs transition-all duration-200"
                  style={{
                    fontSize: 11,
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
                  {/* Attachment preview */}
                  {doc.attachmentName && (
                    <div>
                      <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>Прикреплённый файл</p>
                      <button
                        onClick={handleDownload}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left"
                        style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                      >
                        <div
                          className="flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ width: 36, height: 36, background: 'var(--color-accent-dim)' }}
                        >
                          <FileText size={18} style={{ color: 'var(--color-accent)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-sans truncate" style={{ fontSize: 13, color: 'var(--color-text)' }}>{doc.attachmentName}</p>
                          {doc.attachmentSize && (
                            <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatFileSize(doc.attachmentSize)}</p>
                          )}
                        </div>
                        <Download size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                      </button>
                    </div>
                  )}
                  {!doc.description && !doc.category && !doc.attachmentName && (
                    <p className="font-sans text-center py-8" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Нет дополнительной информации
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'versions' && (
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-px" style={{ background: 'var(--color-border)' }} />
                  <div className="space-y-4 pl-8">
                    {docVersions.map((v) => (
                      <div key={v.version} className="relative">
                        <div
                          className="absolute -left-5 top-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: v.version === doc.version ? 'var(--color-accent)' : 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                        >
                          {v.version === doc.version && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0C0C0E', display: 'block' }} />}
                        </div>
                        <div
                          className="p-3 rounded-lg"
                          style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
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
                          {v.size && (
                            <p className="font-mono mt-1" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                              {formatFileSize(v.size)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  {(doc.comments ?? []).length === 0 && (
                    <p className="font-sans text-center py-4" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Комментариев пока нет
                    </p>
                  )}
                  {(doc.comments ?? []).map((c) => (
                    <div key={c.id} className="p-3 rounded-lg" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar name={c.author.name} size={24} />
                        <span className="font-sans font-medium" style={{ fontSize: 12, color: 'var(--color-text)' }}>{c.author.name}</span>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {formatDate(new Date(c.createdAt))}
                        </span>
                      </div>
                      <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        {c.text}
                      </p>
                    </div>
                  ))}
                  {/* New comment input */}
                  <div
                    className="rounded-lg p-3"
                    style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                  >
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Написать комментарий..."
                      className="w-full bg-transparent outline-none font-sans text-xs resize-none"
                      style={{ color: 'var(--color-text)', minHeight: 60, fontSize: 13 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment()
                      }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Ctrl+Enter — отправить</span>
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all duration-200"
                        style={{
                          background: newComment.trim() ? 'var(--color-accent)' : 'var(--color-surface-hover)',
                          color: newComment.trim() ? '#0C0C0E' : 'var(--color-text-muted)',
                          fontSize: 12, fontWeight: 600,
                          cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Send size={12} />
                        Отправить
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'approvals' && (
                <div>
                  {doc.approvals && doc.approvals.length > 0 ? (
                    <div className="space-y-2">
                      {doc.approvals.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 p-3 rounded-lg"
                          style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                        >
                          <Avatar name={a.user.name} size={32} />
                          <div className="flex-1">
                            <div className="font-sans" style={{ fontSize: 13, color: 'var(--color-text)' }}>{a.user.name}</div>
                            <div className="font-sans" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.user.position}</div>
                          </div>
                          <span
                            className="font-mono text-xs px-2 py-1 rounded-md"
                            style={{
                              background: a.decision === 'APPROVED' ? 'var(--color-success-dim)' : a.decision === 'REJECTED' ? 'var(--color-danger-dim)' : 'var(--color-surface)',
                              color: a.decision === 'APPROVED' ? 'var(--color-success)' : a.decision === 'REJECTED' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                              fontSize: 11,
                            }}
                          >
                            {a.decision === 'APPROVED' ? '✓ Согласовано' : a.decision === 'REJECTED' ? '✗ Отклонено' : '○ На рассмотрении'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-sans text-center py-8" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Процесс согласования не запущен
                    </p>
                  )}
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
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleDownload}
                  title={doc.attachmentName ? `Скачать ${doc.attachmentName}` : 'Нет прикреплённого файла'}
                  style={{ opacity: doc.attachmentName ? 1 : 0.4 }}
                >
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
