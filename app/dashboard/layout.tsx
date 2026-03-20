'use client'

import { Sidebar } from '@/app/components/layout/Sidebar'
import { TopBar } from '@/app/components/layout/TopBar'
import { CommandPalette } from '@/app/components/layout/CommandPalette'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto scrollbar-thin"
          style={{ background: 'var(--color-bg)' }}
        >
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
