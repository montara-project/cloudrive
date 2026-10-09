'use client'

import { cn } from '@/lib/utils'

type StepperProps = {
  steps: string[]
  /** Zero-based index of the active step. */
  current: number
  className?: string
}

/**
 * Segment progress for the onboarding wizard: one bar per step plus a
 * "Step X of N" caption. Exposed as a progressbar so screen readers announce
 * position without reading every step label.
 */
export default function Stepper({ steps, current, className }: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
        className="flex items-center gap-1.5"
      >
        {steps.map((step, index) => (
          <span
            key={step}
            aria-hidden
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              index <= current ? 'bg-primary' : 'bg-border'
            )}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Step {current + 1} of {steps.length}
        <span className="sr-only">: {steps[current]}</span>
      </p>
    </div>
  )
}
