import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ru } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, fmt = 'dd.MM.yyyy'): string {
  return format(new Date(date), fmt, { locale: ru })
}

export function formatDateLong(date: Date | string): string {
  return format(new Date(date), 'EEEE, d MMMM yyyy года', { locale: ru })
}

export function formatDateRelative(date: Date | string): string {
  const d = new Date(date)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'вчера'
  return formatDistanceToNow(d, { locale: ru, addSuffix: true })
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), 'HH:mm')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function generateDocNumber(code: string, count: number): string {
  return `${code}-${String(count).padStart(3, '0')}`
}
