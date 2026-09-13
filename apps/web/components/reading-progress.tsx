'use client'

import { useEffect, useRef } from 'react'

/**
 * Thin reading-progress bar pinned to the top of the viewport. It reflects
 * scroll position directly (no transition), so it stays meaningful for
 * prefers-reduced-motion users.
 */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    let raf = 0
    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0
      bar.style.transform = `scaleX(${progress})`
    }
    const scheduleUpdate = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60]">
      <div
        ref={barRef}
        className="h-0.5 origin-left bg-primary"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  )
}
