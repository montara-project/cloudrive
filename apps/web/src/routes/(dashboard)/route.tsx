import { createFileRoute, Outlet } from '@tanstack/react-router'

import DashboardGate from '@/components/block/auth/dashboard-gate'

/** Every route under (dashboard) needs a session and at least one organization. */
export const Route = createFileRoute('/(dashboard)')({
  component: () => (
    <DashboardGate>
      <Outlet />
    </DashboardGate>
  ),
})
