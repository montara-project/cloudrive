'use client'

import {
  IconFile,
  IconFileCode,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileTypeZip,
  IconMusic,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'

type FileIconProps = {
  fileName: string
  contentType?: string
  className?: string
}

export type FileCategory =
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'archive'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'other'

type FileKind = {
  Icon: typeof IconFile
  className: string
}

// FILE_KINDS maps file extensions to a glyph + tint, ordered so specific
// formats win over their generic family. fileCategory() exposes the same
// mapping to the drive page's type filter.
const FILE_KINDS: Array<{ category: FileCategory; extensions: string[]; kind: FileKind }> = [
  {
    category: 'pdf',
    extensions: ['pdf'],
    kind: { Icon: IconFileTypePdf, className: 'bg-red-50 text-red-500 dark:bg-red-950/50' },
  },
  {
    category: 'document',
    extensions: ['doc', 'docx', 'txt', 'md', 'rtf', 'pages'],
    kind: { Icon: IconFileTypeDoc, className: 'bg-blue-50 text-blue-500 dark:bg-blue-950/50' },
  },
  {
    category: 'spreadsheet',
    extensions: ['xls', 'xlsx', 'csv', 'numbers'],
    kind: {
      Icon: IconFileTypeXls,
      className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50',
    },
  },
  {
    category: 'archive',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
    kind: { Icon: IconFileTypeZip, className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50' },
  },
  {
    category: 'image',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'bmp'],
    kind: { Icon: IconPhoto, className: 'bg-violet-50 text-violet-500 dark:bg-violet-950/50' },
  },
  {
    category: 'video',
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    kind: { Icon: IconVideo, className: 'bg-rose-50 text-rose-500 dark:bg-rose-950/50' },
  },
  {
    category: 'audio',
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'],
    kind: { Icon: IconMusic, className: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50' },
  },
  {
    category: 'code',
    extensions: [
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'go',
      'py',
      'rb',
      'rs',
      'java',
      'html',
      'css',
      'scss',
      'sh',
      'yml',
      'yaml',
      'toml',
      'sql',
    ],
    kind: { Icon: IconFileCode, className: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50' },
  },
]

const FALLBACK_KIND: FileKind = { Icon: IconFile, className: 'bg-muted text-muted-foreground' }

/**
 * FileCategory resolves a file's category from its extension, falling back to
 * the content type for object stores whose names carry no extension.
 */
export function fileCategory(fileName: string, contentType?: string): FileCategory {
  const extension = fileName.includes('.')
    ? fileName.split('.').pop()!.toLowerCase()
    : (contentType?.split('/').pop()?.toLowerCase() ?? '')

  return FILE_KINDS.find(({ extensions }) => extensions.includes(extension))?.category ?? 'other'
}

/**
 * FileIcon renders the tinted glyph for a file's extension. Content type is
 * the fallback signal for keyless/object stores whose names carry no
 * extension.
 */
export default function FileIcon({ fileName, contentType, className }: FileIconProps) {
  const kind =
    FILE_KINDS.find(({ category }) => category === fileCategory(fileName, contentType))?.kind ??
    FALLBACK_KIND

  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg',
        kind.className,
        className
      )}
    >
      <kind.Icon className="size-4.5" />
    </div>
  )
}
