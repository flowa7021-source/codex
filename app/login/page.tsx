'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Demo login
    if (email && password) {
      router.push('/dashboard')
    } else {
      setError('Введите email и пароль')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center font-mono font-bold mx-auto mb-4"
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--color-accent), rgba(212,160,84,0.5))',
              color: '#0C0C0E',
              fontSize: 24,
            }}
          >
            N
          </div>
          <h1
            className="font-mono font-bold"
            style={{ fontSize: 22, letterSpacing: '0.12em', color: 'var(--color-text)' }}
          >
            NEXUS
          </h1>
          <p className="font-mono mt-1" style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
            Command Center
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-xl p-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <h2 className="font-sans font-semibold mb-5" style={{ fontSize: 18, color: 'var(--color-text)' }}>
            Вход в систему
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Email
              </label>
              <Input
                icon={Mail}
                type="email"
                placeholder="user@umit.ru"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Пароль
              </label>
              <Input
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="font-sans text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
            )}
            <Button type="submit" variant="primary" size="md" className="w-full justify-center">
              Войти
            </Button>
          </form>
          <p className="font-mono text-center mt-4" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Demo: любой email + пароль
          </p>
        </div>
      </motion.div>
    </div>
  )
}
