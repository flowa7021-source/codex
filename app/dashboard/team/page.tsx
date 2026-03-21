'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Trash2, Users, Mail, Briefcase, Shield } from 'lucide-react'
import { Avatar } from '@/app/components/ui/Avatar'

interface TeamMember {
  id: string
  name: string
  position: string
  role: 'MANAGER' | 'MEMBER' | 'OBSERVER'
  status: 'ONLINE' | 'AWAY' | 'OFFLINE'
  email: string
  isCurrentUser?: boolean
}

const ROLE_LABELS: Record<TeamMember['role'], string> = {
  MANAGER: 'Руководитель',
  MEMBER: 'Участник',
  OBSERVER: 'Наблюдатель',
}

const STATUS_LABELS: Record<TeamMember['status'], string> = {
  ONLINE: 'Онлайн',
  AWAY: 'Отошёл',
  OFFLINE: 'Офлайн',
}

const STATUS_COLORS: Record<TeamMember['status'], string> = {
  ONLINE: 'var(--color-success)',
  AWAY: 'var(--color-warning)',
  OFFLINE: 'var(--color-text-muted)',
}

const CURRENT_USER: TeamMember = {
  id: 'u1',
  name: 'Крот',
  position: 'Оперативный командир',
  role: 'MANAGER',
  status: 'ONLINE',
  email: 'krot@nexus.ru',
  isCurrentUser: true,
}

const STORAGE_KEY = 'nexus-team'

function loadMembers(): TeamMember[] {
  if (typeof window === 'undefined') return [CURRENT_USER]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [CURRENT_USER]
    const parsed = JSON.parse(raw) as TeamMember[]
    // Ensure current user is always present with isCurrentUser flag
    const hasCurrent = parsed.some(m => m.id === 'u1')
    if (!hasCurrent) return [CURRENT_USER, ...parsed]
    return parsed.map(m => m.id === 'u1' ? { ...m, isCurrentUser: true } : m)
  } catch {
    return [CURRENT_USER]
  }
}

function saveMembers(members: TeamMember[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
}

const EMPTY_FORM: Omit<TeamMember, 'id'> = {
  name: '',
  position: '',
  role: 'MEMBER',
  status: 'ONLINE',
  email: '',
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([CURRENT_USER])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Omit<TeamMember, 'id'>>({ ...EMPTY_FORM })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [tasks, setTasks] = useState<{ assigneeId?: string; status?: string }[]>([])

  useEffect(() => {
    setMembers(loadMembers())
    try {
      const raw = localStorage.getItem('nexus-tasks')
      if (raw) setTasks(JSON.parse(raw))
    } catch {}
  }, [])

  const updateMembers = (next: TeamMember[]) => {
    setMembers(next)
    saveMembers(next)
  }

  const handleAdd = () => {
    if (!form.name.trim()) return
    const newMember: TeamMember = {
      id: `m_${Date.now()}`,
      ...form,
      name: form.name.trim(),
      position: form.position.trim() || 'Участник команды',
      email: form.email.trim(),
    }
    updateMembers([...members, newMember])
    setForm({ ...EMPTY_FORM })
    setShowModal(false)
  }

  const handleDelete = (id: string) => {
    updateMembers(members.filter(m => m.id !== id))
    setDeleteConfirm(null)
  }

  const getTaskCount = (memberId: string, done = false) =>
    tasks.filter(t => t.assigneeId === memberId && (done ? t.status === 'DONE' : t.status !== 'DONE')).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
            Команда
          </h1>
          <p className="font-mono mt-1" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {members.length} {members.length === 1 ? 'участник' : members.length < 5 ? 'участника' : 'участников'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs transition-all duration-200"
          style={{
            background: 'var(--color-accent)',
            color: '#0C0C0E',
            fontWeight: 600,
            fontSize: 13,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={16} />
          Добавить участника
        </button>
      </div>

      {/* Members grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        <AnimatePresence>
          {members.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="rounded-xl p-5 relative group"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {/* Delete button (not for current user) */}
              {!member.isCurrentUser && (
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {deleteConfirm === member.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="px-2 py-1 rounded-md font-mono text-xs"
                        style={{ background: 'var(--color-danger)', color: '#fff', fontSize: 11 }}
                      >
                        Удалить
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 rounded-md font-mono text-xs"
                        style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)', fontSize: 11 }}
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(member.id)}
                      className="p-1.5 rounded-md transition-all duration-200"
                      style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--color-danger)'
                        e.currentTarget.style.color = '#fff'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--color-text-muted)'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Profile */}
              <div className="flex items-center gap-4 mb-5" style={{ paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
                <div className="relative flex-shrink-0">
                  <Avatar name={member.name} size={52} />
                  <span
                    style={{
                      position: 'absolute', bottom: 1, right: 1,
                      width: 12, height: 12, borderRadius: '50%',
                      background: STATUS_COLORS[member.status],
                      border: '2px solid var(--color-surface)',
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-sans font-bold" style={{ fontSize: 15, color: 'var(--color-text)' }}>
                      {member.name}
                    </h3>
                    {member.isCurrentUser && (
                      <span className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)', fontSize: 10 }}>
                        Вы
                      </span>
                    )}
                  </div>
                  <p className="font-sans mt-0.5 truncate" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {member.position}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="font-mono px-2 py-0.5 rounded-sm" style={{ background: 'var(--color-elevated)', color: 'var(--color-text-secondary)', fontSize: 10, border: '1px solid var(--color-border)' }}>
                      {ROLE_LABELS[member.role]}
                    </span>
                    <span className="flex items-center gap-1 font-mono" style={{ fontSize: 10, color: STATUS_COLORS[member.status] }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[member.status], display: 'inline-block', flexShrink: 0 }} />
                      {STATUS_LABELS[member.status]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'Активных задач', value: getTaskCount(member.id, false), color: 'var(--color-info)' },
                  { label: 'Завершено', value: getTaskCount(member.id, true), color: 'var(--color-success)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                    <div className="font-mono font-bold" style={{ fontSize: 22, color }}>{value}</div>
                    <div className="font-mono mt-0.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>{label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              {/* Email */}
              {member.email && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                  <Mail size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                  <span className="font-sans truncate" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{member.email}</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add member modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="w-full max-w-md rounded-2xl p-6"
                style={{
                  background: 'var(--color-elevated)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)',
                  pointerEvents: 'all',
                }}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-mono font-bold" style={{ fontSize: 16, color: 'var(--color-text)', letterSpacing: '0.05em' }}>
                    НОВЫЙ УЧАСТНИК
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1.5 rounded-lg transition-all duration-200"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Name */}
                  <div>
                    <label className="font-mono text-xs mb-1.5 block" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
                      ИМЯ *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Позывной или имя"
                      className="w-full rounded-lg px-3 py-2.5 font-sans text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                      autoFocus
                    />
                  </div>

                  {/* Position */}
                  <div>
                    <label className="font-mono text-xs mb-1.5 block" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
                      ДОЛЖНОСТЬ
                    </label>
                    <input
                      type="text"
                      value={form.position}
                      onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                      placeholder="Роль в команде"
                      className="w-full rounded-lg px-3 py-2.5 font-sans text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="font-mono text-xs mb-1.5 block" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
                      EMAIL
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="user@nexus.ru"
                      className="w-full rounded-lg px-3 py-2.5 font-sans text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    />
                  </div>

                  {/* Role + Status row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-mono text-xs mb-1.5 block" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
                        РОЛЬ
                      </label>
                      <select
                        value={form.role}
                        onChange={e => setForm(f => ({ ...f, role: e.target.value as TeamMember['role'] }))}
                        className="w-full rounded-lg px-3 py-2.5 font-sans text-sm outline-none"
                        style={{
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          appearance: 'none',
                        }}
                      >
                        {(Object.keys(ROLE_LABELS) as TeamMember['role'][]).map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-mono text-xs mb-1.5 block" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
                        СТАТУС
                      </label>
                      <select
                        value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value as TeamMember['status'] }))}
                        className="w-full rounded-lg px-3 py-2.5 font-sans text-sm outline-none"
                        style={{
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          appearance: 'none',
                        }}
                      >
                        {(Object.keys(STATUS_LABELS) as TeamMember['status'][]).map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg font-mono text-xs transition-all duration-200"
                    style={{
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-secondary)',
                      fontSize: 13,
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!form.name.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs transition-all duration-200"
                    style={{
                      background: form.name.trim() ? 'var(--color-accent)' : 'var(--color-surface-hover)',
                      color: form.name.trim() ? '#0C0C0E' : 'var(--color-text-muted)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: form.name.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <Plus size={14} />
                    Добавить
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
