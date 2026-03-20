'use client'

import { create } from 'zustand'

export interface Notification {
  id: string
  title: string
  description?: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: Date
}

interface NotificationsStore {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void
  markAllRead: () => void
  markRead: (id: string) => void
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  notifications: [
    {
      id: '1',
      title: 'Документ ДИ-047 требует согласования',
      description: 'Козлова Е.Н. загрузила новую версию',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: '2',
      title: 'Задача просрочена',
      description: 'График ТО №12 не выполнен в срок',
      type: 'warning',
      read: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: '3',
      title: 'Документ утверждён',
      description: 'Акт проверки №3 успешно утверждён',
      type: 'success',
      read: true,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  ],
  unreadCount: 2,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: String(Date.now()),
          read: false,
          createdAt: new Date(),
        },
        ...state.notifications,
      ],
      unreadCount: state.unreadCount + 1,
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
}))
