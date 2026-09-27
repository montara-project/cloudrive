import { Metadata } from 'next'

import S3Content from '@/components/block/s3/content'
import { META } from '@/lib/constants/meta'

export const metadata: Metadata = {
  ...META,
  title: 'S3 Gateway | Cloudrive',
}

export default function S3Page() {
  return <S3Content />
}
