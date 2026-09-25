'use client'

import type { LucideIcon } from 'lucide-react'

import { useSelector } from '@tanstack/react-form'

import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { useFieldContext } from '@/hooks/form-context'
import { cn } from '@/lib/utils'

export type CheckboxOption = {
  value: string
  label: string
  description?: string
  icon?: LucideIcon
}

type CheckboxGroupFieldProps = {
  options: CheckboxOption[]
  className?: string
}

/**
 * Multi-choice options rendered as selectable cards over a string[] field
 * value. Each checkbox is visually hidden but stays in the accessibility
 * tree; the wrapping label carries the checked/focus styling.
 */
export default function CheckboxGroupField({ options, className }: CheckboxGroupFieldProps) {
  const field = useFieldContext<string[]>()
  const errors = useSelector(field.store, (state) => state.meta.errors)

  const isInvalid = !!errors?.length

  const toggle = (value: string, checked: boolean) => {
    const next = checked
      ? [...field.state.value, value]
      : field.state.value.filter((item) => item !== value)
    field.handleChange(next)
  }

  return (
    <Field data-invalid={isInvalid}>
      <div role="group" className={cn('grid gap-3 sm:grid-cols-2', className)}>
        {options.map((option) => {
          const Icon = option.icon

          return (
            <Label
              key={option.value}
              className={cn(
                'cursor-pointer rounded-xl border border-border bg-card p-4 font-normal',
                'transition-colors duration-200 hover:bg-muted/60',
                'has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2'
              )}
            >
              <Checkbox
                checked={field.state.value.includes(option.value)}
                onCheckedChange={(checked) => toggle(option.value, checked === true)}
                className="sr-only"
              />
              <span className="flex items-start gap-3">
                {Icon && <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />}
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  {option.description && (
                    <span className="text-sm text-muted-foreground">{option.description}</span>
                  )}
                </span>
              </span>
            </Label>
          )
        })}
      </div>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
