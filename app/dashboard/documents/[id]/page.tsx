'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MOCK_DOCUMENTS } from '@/app/lib/mock-data'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { Avatar } from '@/app/components/ui/Avatar'
import { formatDate } from '@/app/lib/utils'

export default function DocumentPage() {
  const { id } = useParams()
  const doc = MOCK_DOCUMENTS.find(d => d.id === id)

  if (!doc) {
    return (
      <div className="p-6">
        <p style={{ color: 'var(--color-text-muted)' }}>Документ не найден</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <Link
        href="/dashboard/documents"
        className="flex items-center gap-2 font-sans text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={16} />
        Назад к документам
      </Link>

      <div
        className="rounded-lg p-6"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Документ #{doc.number}
            </p>
            <h1 className="font-sans font-bold mt-1" style={{ fontSize: 22, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {doc.title}
            </h1>
          </div>
          <StatusBadge type="document" status={doc.status} />
        </div>

        {doc.description && (
          <p className="font-sans" style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            {doc.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-5">
          {[
            { label: 'Автор', value: (
              <div className="flex items-center gap-2">
                <Avatar name={doc.author.name} size={24} />
                <span>{doc.author.name}</span>
              </div>
            )},
            { label: 'Приоритет', value: <StatusBadge type="priority" status={doc.priority} /> },
            { label: 'Версия', value: `v${doc.version}` },
            { label: 'Создан', value: formatDate(doc.createdAt) },
            { label: 'Обновлён', value: formatDate(doc.updatedAt) },
            { label: 'Срок', value: doc.dueDate ? formatDate(doc.dueDate) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>{label}</p>
              <div className="font-sans" style={{ fontSize: 14, color: 'var(--color-text)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
