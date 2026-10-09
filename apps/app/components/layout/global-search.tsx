'use client'

import {
  IconBucket,
  IconClock,
  IconCloud,
  IconFolder,
  IconHome,
  IconPackages,
  IconSearch,
  IconSettings,
  IconStar,
  IconUsers,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'
import { queries } from '@/lib/api/queries'

// Mirrors the sidebar so the palette never advertises a destination the
// sidebar dropped.
const NAV_ITEMS = [
  { title: 'Home', url: '/dashboard', icon: IconHome },
  { title: 'My Drive', url: '/drive', icon: IconFolder },
  { title: 'Shared', url: '/shared', icon: IconUsers },
  { title: 'Recent', url: '/recent', icon: IconClock },
  { title: 'Starred', url: '/starred', icon: IconStar },
  { title: 'Storage', url: '/storage', icon: IconCloud },
  { title: 'Providers', url: '/providers', icon: IconPackages },
  { title: 'S3 Gateway', url: '/s3', icon: IconBucket },
  { title: 'Settings', url: '/settings', icon: IconSettings },
]

/**
 * GlobalSearch is the topbar search pill ("Search in Cloudrive…"). It opens a
 * command palette with the app's destinations plus the active workspace's
 * connected storage accounts. ⌘K / Ctrl+K toggles it from anywhere.
 */
export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { wsId, orgId } = useWorkspaceContext()

  const accountsQuery = useQuery(
    queries.storageAccounts.list(wsId ?? '', { offset: 0, limit: 100 })
  )
  const accounts = accountsQuery.data?.data ?? []

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const scopedHref = useCallback(
    (url: string) => {
      const params = new URLSearchParams()
      if (orgId) params.set('org', orgId)
      if (wsId && (url === '/storage' || url === '/s3')) params.set('ws', wsId)
      const query = params.toString()
      return query ? `${url}?${query}` : url
    },
    [orgId, wsId]
  )

  const navigate = (url: string) => {
    setOpen(false)
    router.push(scopedHref(url))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xs cursor-pointer items-center gap-2.5 rounded-full border bg-muted/60 px-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:max-w-sm"
      >
        <IconSearch className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search in Cloudrive…</span>
        <kbd className="hidden rounded-md border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages and accounts…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigation">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.title} value={item.title} onSelect={() => navigate(item.url)}>
                <item.icon />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {wsId && accounts.length > 0 && (
            <CommandGroup heading="Storage accounts">
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={`${account.display_name} ${account.account_email ?? ''}`}
                  onSelect={() => navigate('/storage')}
                >
                  <IconCloud />
                  <span className="truncate">{account.display_name}</span>
                  {account.account_email && (
                    <span className="truncate text-xs text-muted-foreground">
                      {account.account_email}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
