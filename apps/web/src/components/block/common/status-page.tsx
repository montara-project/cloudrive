import { Link } from '@tanstack/react-router'

interface StatusPageProps {
  code: string
  title: string
  description: string
  action?: React.ReactNode
}

/** Full-page message for the router's 404 and error boundaries. */
export default function StatusPage({ code, title, description, action }: StatusPageProps) {
  return (
    <main className="bg-dotgrid flex min-h-svh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-primary">{code}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
        <div className="mt-8 flex justify-center gap-3">
          {action}
          <Link
            to="/"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-blue-500"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
