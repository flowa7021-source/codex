'use client'

import { motion } from 'framer-motion'
import { User, Bell, Shield, Palette, Database } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { Avatar } from '@/app/components/ui/Avatar'

const SETTINGS_SECTIONS = [
  { icon: User, label: 'Профиль' },
  { icon: Bell, label: 'Уведомления' },
  { icon: Shield, label: 'Безопасность' },
  { icon: Palette, label: 'Внешний вид' },
  { icon: Database, label: 'Данные' },
]

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl space-y-5">
      <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
        Настройки
      </h1>

      {/* Profile section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <User size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--color-text)' }}>
              Профиль
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name="Салахутдинов М.М." size={56} />
            <div>
              <p className="font-sans font-medium" style={{ fontSize: 15, color: 'var(--color-text)' }}>
                Салахутдинов М.М.
              </p>
              <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Начальник УМиТ
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Имя
              </label>
              <Input value="Мухаммад Маратович" onChange={() => {}} />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Фамилия
              </label>
              <Input value="Салахутдинов" onChange={() => {}} />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Email
              </label>
              <Input value="salakhutdinov@umit.ru" type="email" onChange={() => {}} />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Должность
              </label>
              <Input value="Начальник УМиТ" onChange={() => {}} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="md">Сохранить</Button>
          </div>
        </div>
      </motion.div>

      {/* Notifications section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--color-text)' }}>
              Уведомления
            </h2>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {[
            'Новые задачи назначены мне',
            'Документы требуют согласования',
            'Комментарии к моим документам',
            'Просроченные задачи',
          ].map((label) => (
            <div key={label} className="flex items-center justify-between py-2">
              <span className="font-sans" style={{ fontSize: 14, color: 'var(--color-text)' }}>
                {label}
              </span>
              <div
                className="w-10 h-5 rounded-full relative cursor-pointer transition-all"
                style={{ background: 'var(--color-accent)' }}
              >
                <div
                  className="absolute right-1 top-1 w-3 h-3 rounded-full"
                  style={{ background: '#0C0C0E' }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Palette size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--color-text)' }}>
              Внешний вид
            </h2>
          </div>
        </div>
        <div className="p-5">
          <p className="font-sans" style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            Тёмная тема активна. Светлая тема будет доступна в следующем обновлении.
          </p>
          <div className="flex gap-3 mt-4">
            <div
              className="flex-1 h-20 rounded-lg border-2 flex items-center justify-center font-mono text-xs"
              style={{ background: '#0C0C0E', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
            >
              Тёмная ✓
            </div>
            <div
              className="flex-1 h-20 rounded-lg border flex items-center justify-center font-mono text-xs"
              style={{ background: '#F5F5F0', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Светлая
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
