'use client'

import { IconCloud } from '@tabler/icons-react'

import SectionCard from '@/components/block/common/section-card'
import StatusBadge from '@/components/block/common/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { useProviders } from '@/lib/api/queries'

export default function ProvidersPage() {
  const providers = useProviders()

  return (
    <SectionCard
      title="Providers"
      description="Storage providers available for connecting accounts."
    >
      {providers.isLoading ? (
        <div className="py-10 text-center">
          <span className="inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (providers.data?.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No providers registered yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(providers.data?.data ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IconCloud className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.protocol} · {p.auth_type}
                    </p>
                  </div>
                </div>
                <StatusBadge value={p.is_active ? 'active' : 'revoked'} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
