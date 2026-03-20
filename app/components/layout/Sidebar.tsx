'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
  { href: '/dashboard', label: 'Обзор', icon: LayoutDashboard },
  { href: '/dashboard/documents', label: 'Документы', icon: FileText },
  { href: '/dashboard/tasks', label: 'Задачи', icon: CheckSquare },
  { href: '/dashboard/team', label: 'Команда', icon: Users },
  { href: '/dashboard/analytics', label: 'Аналитика', icon: BarChart3 },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  active: boolean
  collapsed: boolean
}) {
  const item = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
        active
          ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
      )}
      style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
    >
      <Icon size={20} />
      {!collapsed && (
        <span
          className="font-mono text-xs tracking-wide whitespace-nowrap overflow-hidden"
          style={{ fontSize: '13px' }}
        >
          {label}
        </span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip.Provider delayDuration={100}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{item}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={8}
              className="px-2 py-1 text-xs font-mono rounded-md z-50"
              style={{
                background: 'var(--color-elevated)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              {label}
              <Tooltip.Arrow style={{ fill: 'var(--color-border)' }} />
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
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
        style={{
          height: 52,
          borderBottom: '1px solid var(--color-border)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        {/* N Square */}
        <div
          className="flex-shrink-0 flex items-center justify-center font-mono font-bold text-sm"
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: 'linear-gradient(135deg, var(--color-accent), rgba(212,160,84,0.5))',
            color: '#0C0C0E',
            fontSize: 16,
          }}
        >
          N
        </div>
        {!collapsed && (
          <div>
            <div
              className="font-mono font-bold"
              style={{ fontSize: 15, letterSpacing: '0.12em', color: 'var(--color-text)' }}
            >
              NEXUS
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
            >
              Command Center
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <NavItem
              key={item.href}
              {...item}
              active={active}
              collapsed={collapsed}
            />
          )
        })}
      </nav>

      {/* Settings & Collapse */}
      <div
        className="flex flex-col gap-1 px-2 py-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        {!collapsed && (
          <Link
            href="/dashboard/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
              pathname === '/dashboard/settings'
                ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
            )}
          >
            <Settings size={20} />
            <span className="font-mono text-xs" style={{ fontSize: '13px' }}>Настройки</span>
          </Link>
        )}
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 w-full text-left"
          style={{
            color: 'var(--color-text-muted)',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && (
            <span className="font-mono text-xs" style={{ fontSize: '12px' }}>Свернуть</span>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
