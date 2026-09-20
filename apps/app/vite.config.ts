import { cloudflare } from '@cloudflare/vite-plugin'
import { cdnAdapter } from '@vinext/cloudflare/cache/cdn-adapter'
import { kvDataAdapter } from '@vinext/cloudflare/cache/kv-data-adapter'
import { imagesOptimizer } from '@vinext/cloudflare/images/images-optimizer'
import vinext from 'vinext'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3001,
  },
  plugins: [
    vinext({
      cache: { data: kvDataAdapter(), cdn: cdnAdapter() },
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
