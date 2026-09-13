'use client'

import { useEffect, useState } from 'react'

export type TocItem = { id: string; title: string }

/**
 * In-page table of contents with scroll-spy. The active section is highlighted
 * (Navigation: active state — ui-ux-pro-max ux-guidelines). Falls back to plain
 * anchor links without JS; smooth scrolling comes from globals.css and is
 * disabled for prefers-reduced-motion users.
 */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | undefined>(items[0]?.id)

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (headings.length === 0 || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      // Track a band just below the sticky header down to ~2/3 of the viewport.
      { rootMargin: '-96px 0px -66% 0px', threshold: 0 }
    )
    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [items])

  const activeIndex = items.findIndex((item) => item.id === activeId)

  function handleNavigate(event: React.MouseEvent<HTMLAnchorElement>) {
    // Close the enclosing <details> on mobile after jumping.
    event.currentTarget.closest('details')?.removeAttribute('open')
  }

  return (
    <nav aria-label="On this page">
      <ul className="space-y-1 border-l-2 border-border">
        {items.map((item, index) => {
          const isActive = index === activeIndex
          const isRead = index < activeIndex
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={handleNavigate}
                aria-current={isActive ? 'location' : undefined}
                className={`-ml-[2px] block border-l-2 px-4 py-1.5 text-sm transition-colors duration-150 ${
                  isActive
                    ? 'border-primary font-semibold text-primary'
                    : isRead
                      ? 'border-primary/30 text-muted-foreground hover:border-border hover:text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {item.title}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
