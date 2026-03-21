'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react'
import { useSidebarStore } from '@/app/stores/sidebar'
import { cn } from '@/app/lib/utils'
import * as Tooltip from '@radix-ui/react-tooltip'

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Обзор',     icon: LayoutDashboard },
  { href: '/dashboard/documents',  label: 'Документы', icon: FileText },
  { href: '/dashboard/tasks',      label: 'Задачи',    icon: CheckSquare },
  { href: '/dashboard/team',       label: 'Команда',   icon: Users },
  { href: '/dashboard/analytics',  label: 'Аналитика', icon: BarChart3 },
]

function NavItem({
  href, label, icon: Icon, active, collapsed,
}: {
  href: string; label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  active: boolean; collapsed: boolean
}) {
  const item = (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-3 rounded-lg transition-all duration-200 group select-none',
        collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2.5',
      )}
      style={{
        background: active
          ? 'linear-gradient(135deg, rgba(114,121,245,0.15) 0%, rgba(114,121,245,0.07) 100%)'
          : 'transparent',
        color: active ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
        boxShadow: active ? 'inset 1px 0 0 var(--color-accent)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(114,121,245,0.07)'
          e.currentTarget.style.color = 'var(--color-text-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--color-text-muted)'
        }
      }}
    >
      <Icon
        size={18}
        strokeWidth={active ? 2 : 1.75}
      />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden whitespace-nowrap"
            style={{
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip.Provider delayDuration={80}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{item}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={10}
              className="z-50"
            >
              <div
                className="font-mono px-2.5 py-1.5 rounded-lg text-xs"
                style={{
                  background: 'var(--color-elevated)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border-strong)',
                  boxShadow: 'var(--shadow-md)',
                  letterSpacing: '0.03em',
                }}
              >
                {label}
              </div>
              <Tooltip.Arrow style={{ fill: 'var(--color-border-strong)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    )
  }

  return item
}

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore()
  const pathname = usePathname()

  return (
    <motion.aside
      animate={{ width: collapsed ? 60 : 224 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden relative"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Subtle top-right gradient glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 120,
          height: 120,
          background: 'radial-gradient(circle at top right, rgba(114,121,245,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center flex-shrink-0 overflow-hidden"
        style={{
          height: 56,
          padding: collapsed ? '0 14px' : '0 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
        }}
      >
        {/* Logo mark */}
        <div
          className="flex-shrink-0 flex items-center justify-center font-mono font-bold relative"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'linear-gradient(140deg, #7279F5 0%, #5B62D9 60%, #4A52C8 100%)',
            color: '#fff',
            fontSize: 15,
            letterSpacing: '-0.02em',
            boxShadow: '0 0 0 1px rgba(114,121,245,0.4), 0 4px 14px rgba(114,121,245,0.3)',
          }}
        >
          N
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <div
                className="font-mono font-bold leading-none"
                style={{ fontSize: 14, letterSpacing: '0.14em', color: 'var(--color-text)' }}
              >
                NEXUS
              </div>
              <div
                className="font-mono mt-0.5"
                style={{ fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}
              >
                Command Center
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin px-1.5">
        {!collapsed && (
          <div
            className="font-mono px-2 pb-1.5 pt-0.5"
            style={{ fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
          >
            Навигация
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <NavItem key={item.href} {...item} active={active} collapsed={collapsed} />
          )
        })}
      </nav>

      {/* ── Bottom ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-0.5 px-1.5 py-3"
        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
      >
        {/* Settings */}
        {!collapsed ? (
          <Link
            href="/dashboard/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
              pathname === '/dashboard/settings'
                ? 'text-[var(--color-accent-hover)]'
                : 'text-[var(--color-text-muted)]',
            )}
            style={{
              background: pathname === '/dashboard/settings'
                ? 'linear-gradient(135deg, rgba(114,121,245,0.15) 0%, rgba(114,121,245,0.07) 100%)'
                : 'transparent',
              boxShadow: pathname === '/dashboard/settings' ? 'inset 1px 0 0 var(--color-accent)' : 'none',
              fontSize: 13,
            }}
            onMouseEnter={(e) => {
              if (pathname !== '/dashboard/settings') {
                e.currentTarget.style.background = 'rgba(114,121,245,0.07)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              if (pathname !== '/dashboard/settings') {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-muted)'
              }
            }}
          >
            <Settings size={18} strokeWidth={1.75} />
            <span style={{ fontWeight: 400 }}>Настройки</span>
          </Link>
        ) : (
          <Tooltip.Provider delayDuration={80}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center justify-center py-2.5 mx-1 rounded-lg transition-all duration-200"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(114,121,245,0.07)'
                    e.currentTarget.style.color = 'var(--color-text-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--color-text-muted)'
                  }}
                >
                  <Settings size={18} strokeWidth={1.75} />
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="right" sideOffset={10}>
                  <div className="font-mono px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--color-elevated)', color: 'var(--color-text)', border: '1px solid var(--color-border-strong)', boxShadow: 'var(--shadow-md)' }}>
                    Настройки
                  </div>
                  <Tooltip.Arrow style={{ fill: 'var(--color-border-strong)' }} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 w-full"
          style={{
            color: 'var(--color-text-muted)',
            justifyContent: collapsed ? 'center' : 'flex-start',
            fontSize: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(114,121,245,0.07)'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          {collapsed
            ? <ChevronRight size={16} strokeWidth={1.75} />
            : <>
                <ChevronLeft size={16} strokeWidth={1.75} />
                <span style={{ fontWeight: 400 }}>Свернуть</span>
              </>
          }
        </button>
      </div>
    </motion.aside>
  )
}
