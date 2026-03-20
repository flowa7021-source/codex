'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Static export doesn't support server-side redirect().
// Electron loads /dashboard directly; this is just a safety net for /
export default function Home() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard') }, [router])
  return null
}
