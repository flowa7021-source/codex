'use client'

import { useEffect } from 'react'

export function useKeyboardShortcut(
  keys: string[],
  callback: () => void,
  options: { metaKey?: boolean; ctrlKey?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const metaMatch = options.metaKey ? e.metaKey : true
      const ctrlMatch = options.ctrlKey ? e.ctrlKey : true
      const keyMatch = keys.includes(e.key.toLowerCase())

      if (keyMatch && (options.metaKey ? e.metaKey : options.ctrlKey ? e.ctrlKey : true)) {
        e.preventDefault()
        callback()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [keys, callback, options.metaKey, options.ctrlKey])
}
