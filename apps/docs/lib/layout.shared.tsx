import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

import Image from 'next/image'

import { gitConfig } from './shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // The brand mark used by apps/web: logo + "Cloud" with "rive" in blue.
      title: (
        <>
          <Image src="/static/images/cloudrive.png" alt="" width={28} height={28} priority />
          <span className="text-lg font-semibold tracking-tight">
            Cloud<span className="text-blue-600">rive</span>
          </span>
        </>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  }
}
