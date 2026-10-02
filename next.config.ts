import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep the build honest: type and lint errors fail `next build`.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
}

export default nextConfig
