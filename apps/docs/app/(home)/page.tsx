import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 px-4">
      <h1 className="text-2xl font-bold mb-4">Cloudrive documentation</h1>
      <p className="text-fd-muted-foreground mb-6">
        How the web app, the Go API and the S3 gateway work, and how to run and extend them.
      </p>
      <p>
        <Link href="/docs" className="font-medium underline">
          Read the docs
        </Link>
      </p>
    </div>
  )
}
