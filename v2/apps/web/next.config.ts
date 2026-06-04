import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ops/shared', '@ops/rbac', '@ops/api'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'pdfkit', 'nodemailer'],
};

export default nextConfig;
