import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * The public site keeps its own palette and type (`.marketing` in
 * styles.css) on top of the dashboard theme, and always renders light.
 */
export const Route = createFileRoute('/(marketing)')({
  component: () => (
    <div className="marketing">
      <Outlet />
    </div>
  ),
})
