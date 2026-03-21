'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Bell, Palette } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { Avatar } from '@/app/components/ui/Avatar'
import { toast } from 'sonner'

const NOTIFICATIONS = [
  'Новые задачи назначены мне',
  'Документы требуют согласования',
  'Комментарии к моим документам',
  'Просроченные задачи',
]

export default function SettingsPage() {
  const [name, setName] = useState('Крот')
  const [email, setEmail] = useState('krot@nexus.ru')
  const [position, setPosition] = useState('Оперативный командир')
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATIONS.map(n => [n, true]))
  )

  const handleSave = () => {
    toast.success('Профиль сохранён')
  }

  const toggleNotification = (label: string) => {
    setNotifications(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
        Настройки
      </h1>

      {/* Profile */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <User size={15} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-mono font-semibold" style={{ fontSize: 12, color: 'var(--color-text)', letterSpacing: '0.05em' }}>
              ПРОФИЛЬ
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {/* Avatar row */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={name || 'К'} size={64} />
              <span
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--color-success)',
                  border: '2px solid var(--color-surface)',
                }}
              />
            </div>
            <div>
              <p className="font-sans font-semibold" style={{ fontSize: 18, color: 'var(--color-text)' }}>{name || '—'}</p>
              <p className="font-sans mt-0.5" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{position}</p>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded-sm mt-1.5 inline-block"
                style={{ fontSize: 10, background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
              >
                Руководитель
              </span>
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono block mb-1.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.09em' }}>
                ПОЗЫВНОЙ / ИМЯ
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="font-mono block mb-1.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.09em' }}>
                EMAIL
              </label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div className="col-span-2">
              <label className="font-mono block mb-1.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.09em' }}>
                ДОЛЖНОСТЬ
              </label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={handleSave}>Сохранить</Button>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Bell size={15} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-mono font-semibold" style={{ fontSize: 12, color: 'var(--color-text)', letterSpacing: '0.05em' }}>
              УВЕДОМЛЕНИЯ
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-1">
          {NOTIFICATIONS.map((label) => {
            const active = notifications[label]
            return (
              <div
                key={label}
                className="flex items-center justify-between py-3 px-3 rounded-lg cursor-pointer transition-all"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                onClick={() => toggleNotification(label)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span className="font-sans" style={{ fontSize: 14, color: 'var(--color-text)' }}>
                  {label}
                </span>
                {/* Toggle */}
                <div
                  className="relative transition-all duration-300"
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: active ? 'var(--color-accent)' : 'var(--color-border)',
                  }}
                >
                  <div
                    className="absolute top-1 transition-all duration-300"
                    style={{
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      left: active ? 23 : 3,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Palette size={15} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-mono font-semibold" style={{ fontSize: 12, color: 'var(--color-text)', letterSpacing: '0.05em' }}>
              ВНЕШНИЙ ВИД
            </h2>
          </div>
        </div>
        <div className="p-5">
          <div className="flex gap-3">
            <div
              className="flex-1 h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer font-mono text-xs"
              style={{ background: '#0C0C0E', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
            >
              <span style={{ fontSize: 18 }}>◐</span>
              Тёмная ✓
            </div>
            <div
              className="flex-1 h-20 rounded-xl flex flex-col items-center justify-center gap-1 cursor-not-allowed font-mono text-xs"
              style={{ background: '#F5F5F0', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', opacity: 0.4 }}
            >
              <span style={{ fontSize: 18 }}>○</span>
              Светлая
            </div>
          </div>
          <p className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Светлая тема будет доступна в следующем обновлении.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
