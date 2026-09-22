'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppForm } from '@/hooks/form'
import { MagicLinkSchema, SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail, signInWithGoogle, signInWithMagicLink } from '@/lib/auth/email-auth'
import { cn } from '@/lib/utils'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}

function PasswordForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmit: SignInSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)

      try {
        await signInWithEmail(value)
        router.push('/dashboard')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField
        name="email"
        children={(field) => (
          <field.TextField label="Email" placeholder="type your email" asterisk />
        )}
      />

      <form.AppField
        name="password"
        children={(field) => (
          <field.PasswordField label="Password" placeholder="type your password" asterisk />
        )}
      />

      <Field>
        <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </Field>
    </form>
  )
}

function MagicLinkForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: {
      email: '',
    },
    validators: {
      onSubmit: MagicLinkSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)

      try {
        await signInWithMagicLink(value)
        setSentTo(value.email)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    },
  })

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/40 p-6 text-center">
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{sentTo}</span>.
          The link expires in 15 minutes.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField
        name="email"
        children={(field) => (
          <field.TextField label="Email" placeholder="type your email" asterisk />
        )}
      />

      <Field>
        <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
          {isLoading ? 'Sending link...' : 'Email me a sign-in link'}
        </Button>
      </Field>
    </form>
  )
}

export default function LoginSection({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
            <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
              <path
                d="M10.5 22.5a4.6 4.6 0 0 1-.5-9.17A6.3 6.3 0 0 1 22.4 14.4a4.1 4.1 0 0 1-.9 8.1z"
                fill="#fff"
              />
              <circle cx="16" cy="18.4" r="2.1" fill="#D97706" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Welcome to Cloudrive</h1>
          <p className="text-sm text-muted-foreground">All your clouds. One drive.</p>
        </div>

        <Tabs defaultValue="password">
          <TabsList className="w-full">
            <TabsTrigger value="password" className="flex-1">
              Password
            </TabsTrigger>
            <TabsTrigger value="magic-link" className="flex-1">
              Magic link
            </TabsTrigger>
          </TabsList>
          <TabsContent value="password" className="pt-4">
            <PasswordForm />
          </TabsContent>
          <TabsContent value="magic-link" className="pt-4">
            <MagicLinkForm />
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <Button variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
          <GoogleIcon />
          Continue with Google
        </Button>
      </FieldGroup>
    </div>
  )
}
