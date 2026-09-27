'use client'

import { IconDots, IconKey, IconPlugConnected, IconPlugOff, IconRefresh } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import React, { useState } from 'react'
import { toast } from 'sonner'

import type { AccountUsage } from '@/hooks/use-storage-usage'
import type { Models } from '@/lib/api/models'

import ProviderIcon, { providerBrandName } from '@/components/block/common/provider-icon'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import StatusBadge from '@/components/block/common/status-badge'
import { EditStorageAccountForm, RotateCredentialsForm } from '@/components/block/storage/form'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

// USAGE_PALETTE assigns each account a stable bar color (by grid index) so
// its segment in the total-usage bar and its own card match.
export const USAGE_PALETTE = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-400',
  'bg-violet-500',
  'bg-rose-400',
  'bg-cyan-500',
  'bg-orange-400',
  'bg-teal-500',
]

type AccountCardProps = {
  account: Models.StorageAccount
  provider?: Models.Provider
  usage?: AccountUsage
  color: string
  wsId: string
}

export default function AccountCard({ account, provider, usage, color, wsId }: AccountCardProps) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openRotate, setOpenRotate] = useState(false)
  const [openDisconnect, setOpenDisconnect] = useState(false)

  const disconnect = useMutation(queries.storageAccounts.disconnect(wsId))
  const refreshOAuth = useMutation(queries.storageAccounts.refreshOAuth(wsId))

  // OAuth accounts carry a "<slug>:<identifier>" external id (server-side
  // normalization); a prefixed id marks an OAuth-connected account.
  const isOAuthAccount = account.external_account_id.includes(':')

  const handleRefreshTokens = async () => {
    try {
      await refreshOAuth.mutateAsync(account.id)
      toast.success('Tokens renewed')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync(account.id)
      toast.success('Storage account disconnected')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const providerName = providerBrandName(provider?.slug, provider?.name)
  const subtitle =
    account.account_email && account.account_email !== account.display_name
      ? account.account_email
      : providerName

  const percent = usage ? (usage.used / usage.total) * 100 : 0
  const saturated = percent >= 95
  const warning = percent >= 85
  const barColor = saturated ? 'bg-red-500' : warning ? 'bg-amber-500' : color
  const freeColor = saturated
    ? 'text-red-600 dark:text-red-400'
    : warning
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-primary'

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderIcon slug={provider?.slug} name={provider?.name} protocol={provider?.protocol} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{account.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            {account.account_email && subtitle !== account.account_email && (
              <p className="truncate text-xs text-muted-foreground/80">{account.account_email}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden flex-col gap-1 text-xs text-muted-foreground sm:flex">
            <span className="inline-flex items-center justify-end gap-1.5">
              <span className={cn('size-2 rounded-full', barColor)} />
              Used
            </span>
            <span className="inline-flex items-center justify-end gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              Free
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account actions"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <IconDots className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setOpenEdit(true)}>
                <IconPlugConnected /> Edit
              </DropdownMenuItem>
              {isOAuthAccount && (
                <DropdownMenuItem onClick={handleRefreshTokens}>
                  <IconRefresh /> Renew tokens
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setOpenRotate(true)}>
                <IconKey /> Rotate credentials
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setOpenDisconnect(true)}>
                <IconPlugOff /> Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          {usage && (
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(100, Math.max(1.5, percent))}%` }}
            />
          )}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground tabular-nums">
            {usage
              ? `${formatBytes(usage.used)} / ${formatBytes(usage.total)}`
              : 'Usage unavailable'}
          </span>
          {usage && (
            <span className={cn('font-medium tabular-nums', freeColor)}>
              {formatBytes(usage.total - usage.used)} free
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
        <button
          type="button"
          onClick={() => setOpenDisconnect(true)}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <IconPlugOff className="size-4" />
          Disconnect
        </button>
        <StatusBadge value={account.status} />
      </div>

      <SimpleAlertDialog
        title="Disconnect storage account"
        description={`Disconnect "${account.display_name}"? Buckets backed by this account will stop working.`}
        open={openDisconnect}
        onOpenChange={setOpenDisconnect}
        onConfirm={handleDisconnect}
        confirmText="Disconnect"
        variant="destructive"
      />

      <EditStorageAccountForm
        wsId={wsId}
        open={openEdit}
        onOpenChange={setOpenEdit}
        record={account}
      />

      <RotateCredentialsForm
        wsId={wsId}
        open={openRotate}
        onOpenChange={setOpenRotate}
        record={account}
      />
    </div>
  )
}
