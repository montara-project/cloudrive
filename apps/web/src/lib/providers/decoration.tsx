import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'

import { TooltipProvider } from '@/components/ui/tooltip'

import ThemeProvider from './themes'

export default function DecorationProvider({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </NuqsAdapter>
  )
}
