import { useTheme } from 'next-themes'
import * as React from 'react'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      // Sonner v2 inverts toasts by default (black card on light theme), which
      // collides with the forced foreground color below — unreadable in light
      // mode. Pin toasts to the app's own surface in both themes instead.
      invert={false}
      className="group toaster [&_[data-type=success]>[data-icon]]:text-emerald-600 [&_[data-type=info]>[data-icon]]:text-sky-600 [&_[data-type=error]>[data-icon]]:text-destructive dark:[&_[data-type=success]>[data-icon]]:text-emerald-400 dark:[&_[data-type=info]>[data-icon]]:text-sky-400"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background! group-[.toaster]:text-foreground! group-[.toaster]:border-border! group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:rounded-md! group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:rounded-md! group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground!',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
