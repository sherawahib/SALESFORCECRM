import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ops/shared', '@ops/rbac', '@ops/api'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'pdfkit', 'nodemailer'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
