'use client'

import { useState, useEffect, useRef } from 'react'

export function useAnimatedValue(
  target: number,
  duration = 1200,
  delay = 0
): number {
  const [value, setValue] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now()
      const initial = 0

      const animate = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(initial + (target - initial) * eased))

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate)
        }
      }

      frameRef.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, delay])

  return value
}
