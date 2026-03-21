'use client'

import { useState, useEffect } from 'react'
import { Bell, ChevronDown, Settings, LogOut, Search, Maximize2, Minimize2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useCommandPaletteStore } from '@/app/stores/command-palette'
import { useNotificationsStore } from '@/app/stores/notifications'
import { formatDateLong, formatTime, formatDateRelative } from '@/app/lib/utils'
import { Avatar } from '@/app/components/ui/Avatar'

export function TopBar() {
  const [now, setNow] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { setOpen } = useCommandPaletteStore()
  const { notifications, unreadCount, markAllRead } = useNotificationsStore()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return
    api.isFullscreen?.().then((v: boolean) => setIsFullscreen(v))
    const unsubscribe = api.onFullscreenChange?.((v: boolean) => setIsFullscreen(v))
    return () => unsubscribe?.()
  }, [])

  function handleFullscreen() {
    ;(window as any).electronAPI?.toggleFullscreen?.()
  }

  return (
    <header
      className="flex items-center justify-between flex-shrink-0"
      style={{
        height: 52,
        padding: '0 20px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border-subtle)',
        /* Electron drag region — lets user drag window from the topbar */
        WebkitAppRegion: 'drag' as any,
      } as React.CSSProperties}
    >
      {/* Date */}
      <span
        className="font-mono select-none"
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.04em',
        }}
      >
        {formatDateLong(now)}
      </span>

      {/* Right controls — not draggable */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Search */}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg transition-all duration-200"
          style={{
            padding: '5px 10px',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            fontSize: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-strong)'
            e.currentTarget.style.background = 'var(--color-surface-hover)'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)'
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          <Search size={13} strokeWidth={1.75} />
          <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.03em' }}>Поиск</span>
          <kbd
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-muted)',
              lineHeight: '16px',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 6px' }} />

        {/* Clock */}
        <div
          className="font-mono font-semibold tabular-nums select-none px-2"
          style={{
            fontSize: 15,
            color: 'var(--color-text-secondary)',
            letterSpacing: '-0.01em',
          }}
        >
          {formatTime(now)}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 6px' }} />

        {/* Fullscreen */}
        <button
          onClick={handleFullscreen}
          title={isFullscreen ? 'Выйти из полноэкранного режима (F11)' : 'Полноэкранный режим (F11)'}
          className="p-2 rounded-lg transition-all duration-200"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          {isFullscreen ? <Minimize2 size={16} strokeWidth={1.75} /> : <Maximize2 size={16} strokeWidth={1.75} />}
        </button>

        {/* Notifications */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="relative p-2 rounded-lg transition-all duration-200"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-hover)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-muted)'
              }}
            >
              <Bell size={16} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1.5 right-1.5"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--color-danger)',
                    border: '1.5px solid var(--color-surface)',
                    animation: 'pulse-dot 2.4s ease-in-out infinite',
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
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-lg)',
                animation: 'fade-in-scale 0.18s ease-out',
              }}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
                >
                  УВЕДОМЛЕНИЯ
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs transition-colors duration-150"
                    style={{ color: 'var(--color-accent)', fontSize: 11 }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
                  >
                    Прочитать все
                  </button>
                )}
              </div>
              <div style={{ height: 1, background: 'var(--color-border)', margin: '0 8px 4px' }} />
              {notifications.length === 0 ? (
                <div className="px-3 py-4 text-center" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                  Нет уведомлений
                </div>
              ) : notifications.slice(0, 5).map((n) => (
                <DropdownMenu.Item
                  key={n.id}
                  className="px-3 py-2.5 rounded-lg cursor-default outline-none"
                  style={{ opacity: n.read ? 0.55 : 1 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-start gap-2.5">
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
                    <div style={{ flex: 1, paddingLeft: n.read ? '14px' : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                        {n.title}
                      </div>
                      {n.description && (
                        <div style={{ fontSize: 12, marginTop: 1, color: 'var(--color-text-muted)' }}>
                          {n.description}
                        </div>
                      )}
                      <div className="font-mono mt-1" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {formatDateRelative(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg p-1.5 pr-2 transition-all duration-200 ml-1"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar name="Крот" size={28} />
              <ChevronDown size={13} strokeWidth={2} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-48 rounded-xl p-1"
              style={{
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-lg)',
                animation: 'fade-in-scale 0.18s ease-out',
              }}
            >
              <div className="px-3 py-2.5">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Крот</div>
                <div style={{ fontSize: 11, marginTop: 2, color: 'var(--color-text-muted)' }}>
                  Оперативный командир
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--color-border)', margin: '2px 8px 4px' }} />
              {[
                { icon: Settings, label: 'Настройки', href: '/dashboard/settings' },
                { icon: LogOut,   label: 'Выход',     href: '/login' },
              ].map((item) => (
                <DropdownMenu.Item key={item.label} asChild>
                  <a
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer outline-none transition-all duration-150"
                    style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: 13 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface-hover)'
                      e.currentTarget.style.color = 'var(--color-text)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--color-text-secondary)'
                    }}
                  >
                    <item.icon size={14} strokeWidth={1.75} />
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
