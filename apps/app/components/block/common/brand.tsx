'use client'

import Image from 'next/image'

import { cn } from '@/lib/utils'

interface CloudriveLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function CloudriveLogo({ size = 'md', className }: CloudriveLogoProps) {
  const sizeMap = {
    xs: 24,
    sm: 32,
    md: 42,
    lg: 52,
    xl: 62,
  }

  const textSize = {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <Image
        src="/static/images/cloudrive-logo-transparant.png"
        width={sizeMap[size]}
        height={sizeMap[size]}
        alt="brand logo"
      />
      <span className={cn(textSize[size], 'font-semibold tracking-tight mt-1 text-[#1e6091]')}>
        Cloudrive
      </span>
    </span>
  )
}
