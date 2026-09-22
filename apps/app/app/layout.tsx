import type { Metadata, Viewport } from 'next'

import './globals.css'

import { Toaster } from '@/components/ui/sonner'
import { META } from '@/lib/constants/meta'
import DecorationProvider from '@/lib/providers/decoration'
import ReactQueryProvider from '@/lib/providers/react-query'

export const metadata: Metadata = META

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          defer
          src="https://analytics.masb0ymas.com/script.js"
          data-website-id="3b1faaaa-6b76-4c63-8621-6547a3ab5771"
        ></script>
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        {/* Flags JS availability so scroll-reveal styles only apply when they can run */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <ReactQueryProvider>
          <DecorationProvider>{children}</DecorationProvider>
        </ReactQueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
