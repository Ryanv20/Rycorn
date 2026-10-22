import type { NextConfig } from 'next'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  turbopack: { root: workspaceRoot },
}

export default nextConfig
