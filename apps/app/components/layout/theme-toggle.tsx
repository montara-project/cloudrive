'use client'

import { IconMoon, IconSun } from '@tabler/icons-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

// The icon pair switches via the .dark class instead of mounted-state so the
// button never renders a stale (SSR) icon; clicking before hydration simply
// resolves to the current theme at event time.
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <IconSun className="size-4.5 dark:hidden" />
      <IconMoon className="hidden size-4.5 dark:block" />
    </Button>
  )
}
