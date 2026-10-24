import { IconExternalLink } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'

interface ExternalLinkProps {
  label?: string
  link: string | null | undefined
}

export default function ExternalLink({ label = 'Visit', link }: ExternalLinkProps) {
  if (!link) {
    return '-'
  }

  return (
    <Button mode="link" underline="solid" asChild>
      <a href={link} target="_blank" rel="noreferrer">
        {label}
        <IconExternalLink />
      </a>
    </Button>
  )
}
