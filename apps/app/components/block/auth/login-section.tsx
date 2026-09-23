'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { MagicLinkSchema, SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail, signInWithGoogle, signInWithMagicLink } from '@/lib/auth/email-auth'
import { cn } from '@/lib/utils'

import BrandMark from './brand-mark'

/** Which credential form the card is showing. Google is an action, not a mode. */
type LoginMode = 'magic-link' | 'password'

const MODE_LABEL: Record<LoginMode, string> = {
  'magic-link': 'Magic link',
  password: 'Email & password',
}

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
  const [mode, setMode] = useState<LoginMode>('magic-link')
  const reduceMotion = useReducedMotion()

  // Swap layout: the active method owns the button above the form, and the
  // remaining two sit below it. Google has no form, so it only ever appears as
  // an alternative — clicking it starts the OAuth redirect instead of swapping.
  const alternatives: Array<{ id: LoginMode | 'google'; label: string }> =
    mode === 'magic-link'
      ? [
          { id: 'password', label: MODE_LABEL.password },
          { id: 'google', label: 'Google' },
        ]
      : [
          { id: 'magic-link', label: MODE_LABEL['magic-link'] },
          { id: 'google', label: 'Google' },
        ]

  const handleAlternative = (id: LoginMode | 'google') => {
    if (id === 'google') {
      signInWithGoogle()
      return
    }
    setMode(id)
  }

  const transition = { duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' } as const
  const formMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <BrandMark className="size-10" />
        <h1 className="text-xl font-bold">Welcome to Cloudrive</h1>
        <p className="text-sm text-muted-foreground">All your clouds. One drive.</p>
      </div>

      {/* Active method. Already selected, so it carries state rather than an
          action — `aria-pressed` tells assistive tech which form is open. */}
      <Button type="button" variant="primary" className="w-full" aria-pressed>
        {MODE_LABEL[mode]}
      </Button>

      {/* Height eases with the swap so the card does not jump between the
          one-field magic-link form and the two-field password form. */}
      <motion.div layout transition={transition}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} transition={transition} {...formMotion}>
            {mode === 'magic-link' ? <MagicLinkForm /> : <PasswordForm />}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="grid grid-cols-2 gap-2">
        {alternatives.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="outline"
            className="w-full"
            // Google is an action, not a toggle, so it gets no pressed state.
            aria-pressed={item.id === 'google' ? undefined : false}
            onClick={() => handleAlternative(item.id)}
          >
            {item.id === 'google' && <GoogleIcon />}
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
