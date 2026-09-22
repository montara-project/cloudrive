'use client'

import { Badge } from '@/components/ui/badge'

const TONE: Record<
  string,
  'success' | 'warning' | 'info' | 'destructive' | 'outline' | 'secondary'
> = {
  active: 'success',
  accepted: 'success',
  owner: 'info',
  pending: 'warning',
  pending_auth: 'warning',
  expired: 'secondary',
  revoked: 'destructive',
  rejected: 'destructive',
  error: 'destructive',
}

export default function StatusBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <Badge variant={TONE[value] ?? 'outline'} size="md" className="capitalize">
      {value.replace(/_/g, ' ')}
    </Badge>
  )
}
