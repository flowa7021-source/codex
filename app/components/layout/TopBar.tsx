'use client'

import { useState, useEffect } from 'react'
import { Bell, ChevronDown, User, Settings, LogOut, Search } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useCommandPaletteStore } from '@/app/stores/command-palette'
import { useNotificationsStore } from '@/app/stores/notifications'
import { formatDateLong, formatTime, formatDateRelative } from '@/app/lib/utils'
import { Avatar } from '@/app/components/ui/Avatar'

export function TopBar() {
  const [now, setNow] = useState(new Date())
  const { setOpen } = useCommandPaletteStore()
  const { notifications, unreadCount, markAllRead } = useNotificationsStore()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header
      className="flex items-center justify-between px-6 flex-shrink-0"
      style={{
        height: 52,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Date */}
      <span
        className="font-mono"
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          textTransform: 'lowercase',
          letterSpacing: '0.02em',
        }}
      >
        {formatDateLong(now)}
      </span>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Command Palette button */}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200"
          style={{
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-muted)',
            fontSize: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent)/30'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          <Search size={12} />
          <span className="font-mono" style={{ fontSize: 12 }}>Поиск</span>
          <kbd
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '0 4px',
              borderRadius: 3,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Clock */}
        <span
          className="font-mono font-semibold tabular-nums"
          style={{ fontSize: 16, color: 'var(--color-accent)' }}
        >
          {formatTime(now)}
        </span>

        {/* Notifications */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="relative p-1.5 rounded-md transition-all duration-200"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-hover)'
                e.currentTarget.style.color = 'var(--color-text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--color-danger)',
                    border: '1.5px solid var(--color-surface)',
                    animation: 'pulse-dot 2s ease-in-out infinite',
                  }}
                />
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-72 rounded-xl p-1"
              style={{
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-text)', letterSpacing: '0.08em' }}>
                  УВЕДОМЛЕНИЯ
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="font-mono text-xs"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    Прочитать все
                  </button>
                )}
              </div>
              <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
              {notifications.slice(0, 5).map((n) => (
                <DropdownMenu.Item
                  key={n.id}
                  className="px-3 py-2 rounded-lg cursor-default outline-none"
                  style={{
                    opacity: n.read ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--color-accent)',
                          flexShrink: 0,
                          marginTop: 5,
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="font-sans text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        {n.title}
                      </div>
                      {n.description && (
                        <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {n.description}
                        </div>
                      )}
                      <div className="font-mono text-xs mt-1" style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                        {formatDateRelative(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* User avatar */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 transition-all duration-200"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar name="Крот" size={32} />
              <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-48 rounded-xl p-1"
              style={{
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="px-3 py-2">
                <div className="font-sans text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                  Крот
                </div>
                <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Оперативный командир
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
              {[
                { icon: Settings, label: 'Настройки', href: '/dashboard/settings' },
                { icon: LogOut, label: 'Выход', href: '/login' },
              ].map((item) => (
                <DropdownMenu.Item key={item.label} asChild>
                  <a
                    href={item.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-sans cursor-pointer outline-none"
                    style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface-hover)'
                      e.currentTarget.style.color = 'var(--color-text)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--color-text-secondary)'
                    }}
                  >
                    <item.icon size={14} />
                    {item.label}
                  </a>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
