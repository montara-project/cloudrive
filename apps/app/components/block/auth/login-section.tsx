'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { useAppForm } from '@/hooks/form'
import { MagicLinkSchema, SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail, signInWithGoogle, signInWithMagicLink } from '@/lib/auth/email-auth'
import { cn } from '@/lib/utils'

import { Icons } from '../common/icons'
import BrandMark from './brand-mark'

/** Which credential form the card is showing. Google is an action, not a mode. */
type LoginMode = 'magic-link' | 'password'

const MODE_LABEL: Record<LoginMode, string> = {
  'magic-link': 'Magic link',
  password: 'Email & password',
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

      {/* Height eases with the swap so the card does not jump between the
          one-field magic-link form and the two-field password form. */}
      <motion.div layout transition={transition}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} transition={transition} {...formMotion}>
            {mode === 'magic-link' ? <MagicLinkForm /> : <PasswordForm />}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <Separator />

      <div className="flex flex-col gap-2">
        {alternatives.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="outline"
            className="w-full h-10 flex items-center justify-center text-center"
            aria-pressed={item.id === 'google' ? undefined : false}
            onClick={() => handleAlternative(item.id)}
          >
            {item.id === 'google' && <Icons.googleColorful />}
            <span>{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
