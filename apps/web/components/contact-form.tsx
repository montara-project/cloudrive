'use client'

import { useId, useState } from 'react'

import { CheckIcon } from './icons'

const API_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || 'http://localhost:8080'

const topics = ['General support', 'Billing', 'Sales', 'Security', 'Other']

type Status =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; ticket: string; email: string }
  | { state: 'error'; message: string }

const inputClass =
  'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-ring'

export function ContactForm() {
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState(topics[0])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim().length < 2) {
      setStatus({ state: 'error', message: 'Please enter your name.' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus({ state: 'error', message: 'Please enter a valid email address.' })
      return
    }
    if (message.trim().length < 10) {
      setStatus({
        state: 'error',
        message: 'Please tell us a little more (at least 10 characters).',
      })
      return
    }

    setStatus({ state: 'loading' })
    try {
      const res = await fetch(`${API_URL}/api/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, topic, message }),
      })
      const data = (await res.json()) as { ok: boolean; ticket?: string }
      if (!res.ok || !data.ok) {
        setStatus({ state: 'error', message: 'Something went wrong. Please try again.' })
        return
      }
      setStatus({ state: 'success', ticket: data.ticket ?? '', email: email.trim() })
    } catch {
      setStatus({ state: 'error', message: 'Could not reach the server. Please try again.' })
    }
  }

  if (status.state === 'success') {
    return (
      <div
        className="flex items-start gap-3 rounded-2xl border border-border bg-card p-6"
        role="status"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckIcon className="size-4" />
        </span>
        <div>
          <p className="font-bold text-foreground">Message sent — ticket {status.ticket}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Thanks, {name.trim().split(' ')[0]}! We&apos;ll reply to{' '}
            <strong className="text-foreground">{status.email}</strong> within one business day.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-name`}
            className="mb-1.5 block text-sm font-semibold text-foreground"
          >
            Name
          </label>
          <input
            id={`${id}-name`}
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Maya Krishnan"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (status.state === 'error') setStatus({ state: 'idle' })
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-email`}
            className="mb-1.5 block text-sm font-semibold text-foreground"
          >
            Work email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status.state === 'error') setStatus({ state: 'idle' })
            }}
            aria-invalid={status.state === 'error'}
            aria-describedby={status.state === 'error' ? `${id}-error` : undefined}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`${id}-topic`}
          className="mb-1.5 block text-sm font-semibold text-foreground"
        >
          Topic
        </label>
        <select
          id={`${id}-topic`}
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={`${inputClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23475569%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_1rem_center] bg-[size:1rem] bg-no-repeat pr-10`}
        >
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${id}-message`}
          className="mb-1.5 block text-sm font-semibold text-foreground"
        >
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={5}
          placeholder="Tell us what's up — the more detail, the faster we can help."
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            if (status.state === 'error') setStatus({ state: 'idle' })
          }}
          className={`${inputClass} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status.state === 'loading'}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[0_4px_0_0_#184e77] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-strong active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status.state === 'loading' ? 'Sending…' : 'Send message'}
        </button>
        <div aria-live="polite" className="min-h-5 text-sm">
          {status.state === 'error' && (
            <p id={`${id}-error`} className="font-medium text-destructive" role="alert">
              {status.message}
            </p>
          )}
        </div>
      </div>
    </form>
  )
}
