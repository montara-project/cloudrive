'use client'

import SectionCard from '@/components/block/common/section-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspaceContext } from '@/hooks/use-workspace-context'

import BucketsTab from './buckets-tab'
import CredentialsTab from './credentials-tab'

export default function S3Content() {
  const { workspace, wsId } = useWorkspaceContext()

  return (
    <SectionCard
      title="S3 Gateway"
      description={
        workspace
          ? `S3-compatible credentials and virtual buckets for ${workspace.name}.`
          : 'S3-compatible credentials and virtual buckets for the selected workspace.'
      }
    >
      {!wsId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Pick a workspace in the sidebar to manage the S3 gateway.
        </p>
      ) : (
        <Tabs defaultValue="credentials">
          <TabsList className="mb-4">
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="buckets">Buckets</TabsTrigger>
          </TabsList>
          <TabsContent value="credentials">
            <CredentialsTab wsId={wsId} />
          </TabsContent>
          <TabsContent value="buckets">
            <BucketsTab wsId={wsId} />
          </TabsContent>
        </Tabs>
      )}
    </SectionCard>
  )
}
