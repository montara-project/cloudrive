'use client'

import { IconArrowLeft, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import InvitationsTab from './invitations-tab'
import MembersTab from './members-tab'
import WorkspacesTab from './workspaces-tab'

export default function OrganizationDetailContent({ orgId }: { orgId: string }) {
  const router = useRouter()

  const { data: org, isLoading, isError } = useQuery(queries.organizations.get({ id: orgId }))
  const del = useMutation(queries.organizations.delete())
  const [deleting, setDeleting] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isError || !org?.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-muted-foreground">Organization not found or unavailable.</p>
        <Button variant="outline" onClick={() => router.push('/organizations')}>
          <IconArrowLeft className="size-4" /> Back to organizations
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link href="/organizations">
              <IconArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{org.data.name}</h1>
            <p className="text-sm text-muted-foreground">@{org.data.slug}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
          <IconTrash className="size-4" /> Delete
        </Button>
      </div>

      <SectionCard title={org.data.name} description={`@${org.data.slug}`}>
        <Tabs defaultValue="workspaces">
          <TabsList className="mb-4">
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>
          <TabsContent value="workspaces">
            <WorkspacesTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="invitations">
            <InvitationsTab orgId={orgId} />
          </TabsContent>
        </Tabs>
      </SectionCard>

      <SimpleAlertDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete organization"
        description={`Delete "${org.data.name}"? Its workspaces and storage accounts will be removed. This cannot be undone.`}
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await del.mutateAsync(orgId)
            toast.success('Organization deleted')
            router.push('/organizations')
          } catch (error) {
            toastAxiosError(error)
          }
        }}
      />
    </div>
  )
}
