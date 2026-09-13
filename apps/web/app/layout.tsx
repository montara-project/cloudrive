import type { Metadata, Viewport } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Cloudrive — All your clouds. One drive.',
  description:
    'Cloudrive centers every file from Google Drive, Dropbox, OneDrive, S3, and 12+ other services into a single searchable, syncable drive.',
  keywords: ['cloud storage', 'file sync', 'unified drive', 'Google Drive', 'Dropbox', 'S3'],
  openGraph: {
    title: 'Cloudrive — All your clouds. One drive.',
    description:
      'Stop tab-hopping between cloud storage services. Cloudrive centers every cloud into one searchable, syncable drive.',
    type: 'website',
    siteName: 'Cloudrive',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-background font-sans text-foreground antialiased">
        {/* Flags JS availability so scroll-reveal styles only apply when they can run */}
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
        {children}
      </body>
    </html>
  )
}
