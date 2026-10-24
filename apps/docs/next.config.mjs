import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Emits .next/standalone for the Docker image in apps/docs/Dockerfile.
  output: 'standalone',
}

export default withMDX(config)
