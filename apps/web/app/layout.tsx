import type { Metadata, Viewport } from 'next'

import './globals.css'

import { Poppins } from 'next/font/google'

import { META } from '@/lib/constants/meta'
import { cn } from '@/lib/utils'

export const metadata: Metadata = META

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
})

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          defer
          src="https://analytics.masb0ymas.com/script.js"
          data-website-id="3b1faaaa-6b76-4c63-8621-6547a3ab5771"
        ></script>
      </head>
      <body className={cn(poppins.variable, 'bg-background font-sans text-foreground antialiased')}>
        {/* Flags JS availability so scroll-reveal styles only apply when they can run */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        {children}
      </body>
    </html>
  )
}
