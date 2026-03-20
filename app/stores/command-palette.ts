'use client'

import { create } from 'zustand'

interface CommandPaletteStore {
  open: boolean
  query: string
  setOpen: (open: boolean) => void
  setQuery: (query: string) => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  open: false,
  query: '',
  setOpen: (open) => set({ open, query: '' }),
  setQuery: (query) => set({ query }),
  toggle: () => set((state) => ({ open: !state.open, query: '' })),
}))
