'use client'

import { motion } from 'framer-motion'
import { MOCK_USERS } from '@/app/lib/mock-data'
import { Avatar } from '@/app/components/ui/Avatar'
import { DonutMini } from '@/app/components/charts/DonutMini'

const user = MOCK_USERS[0]

export default function TeamPage() {
  return (
    <div className="p-6 max-w-xl">
      <h1 className="font-mono font-bold mb-5" style={{ fontSize: 22, color: 'var(--color-text)' }}>
        Команда
      </h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="rounded-xl p-6"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Profile header */}
        <div className="flex items-center gap-5 mb-6" style={{ paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
          <div className="relative">
            <Avatar name={user.name} size={72} />
            <span
              style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--color-success)',
                border: '2.5px solid var(--color-surface)',
              }}
            />
          </div>
          <div>
            <h2 className="font-sans font-bold" style={{ fontSize: 24, color: 'var(--color-text)' }}>{user.name}</h2>
            <p className="font-sans mt-0.5" style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{user.position}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="font-mono px-2.5 py-0.5 rounded-sm text-xs"
                style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)', fontSize: 11 }}
              >
                Руководитель
              </span>
              <span className="flex items-center gap-1.5 font-mono" style={{ fontSize: 11, color: 'var(--color-success)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                Онлайн
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Задач активных', value: 0, color: 'var(--color-info)' },
            { label: 'Завершено', value: 0, color: 'var(--color-success)' },
            { label: 'Документов', value: 0, color: 'var(--color-accent)' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-lg p-4 text-center"
              style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
            >
              <div className="font-mono font-bold" style={{ fontSize: 28, color }}>{value}</div>
              <div className="font-mono mt-1" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Email */}
        <div className="rounded-lg px-4 py-3" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>EMAIL</span>
          <p className="font-sans mt-1" style={{ fontSize: 14, color: 'var(--color-text)' }}>{user.email}</p>
        </div>

        <p className="font-sans text-center mt-8" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Вы единственный участник. Пригласить других — в следующей версии.
        </p>
      </motion.div>
    </div>
  )
}
