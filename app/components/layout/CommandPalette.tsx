'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FileText, CheckSquare, Users, BarChart3, Plus, X } from 'lucide-react'
import { useCommandPaletteStore } from '@/app/stores/command-palette'
import { useKeyboardShortcut } from '@/app/hooks/use-keyboard-shortcut'

const DEFAULT_ACTIONS = [
  { id: 'new-doc', label: 'Создать новый документ', icon: Plus, href: '/dashboard/documents?action=new', group: 'Действия' },
  { id: 'tasks', label: 'Все задачи', icon: CheckSquare, href: '/dashboard/tasks', group: 'Переходы' },
  { id: 'analytics', label: 'Аналитика', icon: BarChart3, href: '/dashboard/analytics', group: 'Переходы' },
  { id: 'team', label: 'Команда', icon: Users, href: '/dashboard/team', group: 'Переходы' },
  { id: 'settings', label: 'Настройки', icon: Plus, href: '/dashboard/settings', group: 'Переходы' },
]

interface SearchResult {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ size?: number }>
  href: string
  group: string
}

export function CommandPalette() {
  const { open, query, setOpen, setQuery } = useCommandPaletteStore()
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useKeyboardShortcut(['k'], () => setOpen(!open), { ctrlKey: true })
  useKeyboardShortcut(['k'], () => setOpen(!open), { metaKey: true })

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelected(0)
    }
  }, [open])

  useEffect(() => {
    if (!query) {
      setResults(DEFAULT_ACTIONS as any)
      return
    }

    const q = query.toLowerCase()
    const filtered = DEFAULT_ACTIONS.filter(
      (a) => a.label.toLowerCase().includes(q)
    )

    // Simulate search results
    const docResults: SearchResult[] = []
    if ('ди'.includes(q) || q.includes('документ') || q.includes('ди-')) {
      docResults.push(
        { id: 'd1', label: 'ДИ-047 — Слесарь-ремонтник', description: 'Документ в работе', icon: FileText, href: '/dashboard/documents', group: 'Документы' },
        { id: 'd2', label: 'ДИ-012 — Начальник смены', description: 'Утверждён', icon: FileText, href: '/dashboard/documents', group: 'Документы' },
      )
    }

    setResults([...docResults, ...filtered] as any)
    setSelected(0)
  }, [query])

  const handleSelect = useCallback((item: SearchResult) => {
    setOpen(false)
    router.push(item.href)
  }, [setOpen, router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) handleSelect(results[selected])
  }

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.group]) acc[r.group] = []
    acc[r.group].push(r)
    return acc
  }, {} as Record<string, SearchResult[]>)

  let globalIdx = 0

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-[201] flex justify-center" style={{ paddingTop: 120 }}>
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-lg"
              style={{
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                height: 'fit-content',
                maxHeight: '60vh',
              }}
              onKeyDown={handleKeyDown}
            >
              {/* Input */}
              <div
                className="flex items-center gap-3 px-4"
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  height: 52,
                }}
              >
                <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по документам, задачам, команде..."
                  className="flex-1 bg-transparent outline-none font-sans text-sm"
                  style={{
                    color: 'var(--color-text)',
                    fontSize: 15,
                  }}
                />
                <button onClick={() => setOpen(false)}>
                  <X size={16} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              </div>

              {/* Results */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 52px)' }}>
                {Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <div
                      className="px-4 py-2 font-mono text-xs font-semibold tracking-widest"
                      style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em', fontSize: 11 }}
                    >
                      {group.toUpperCase()}
                    </div>
                    {items.map((item) => {
                      const idx = globalIdx++
                      return (
                        <button
                          key={item.id}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100"
                          style={{
                            background: selected === idx ? 'var(--color-accent-dim)' : 'transparent',
                            color: selected === idx ? 'var(--color-accent)' : 'var(--color-text)',
                          }}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelected(idx)}
                        >
                          <span style={{ color: selected === idx ? 'var(--color-accent)' : 'var(--color-text-secondary)', flexShrink: 0, display: 'flex' }}>
                            <item.icon size={16} />
                          </span>
                          <div>
                            <div className="font-sans text-sm">{item.label}</div>
                            {item.description && (
                              <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {item.description}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
                {results.length === 0 && (
                  <div className="px-4 py-8 text-center font-sans text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Ничего не найдено по запросу «{query}»
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="flex items-center gap-4 px-4 py-2"
                style={{
                  borderTop: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }}
              >
                {[
                  ['↵', 'выбрать'],
                  ['↑↓', 'навигация'],
                  ['Esc', 'закрыть'],
                ].map(([key, action]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <kbd
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: 'var(--color-border)',
                        color: 'var(--color-text-muted)',
                        fontSize: 11,
                      }}
                    >
                      {key}
                    </kbd>
                    <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                      {action}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
