import type { NextConfig } from 'next';

const apiUrl = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@ops/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
