import type { NextConfig } from 'next';
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';

const nextConfig: NextConfig = {
  transpilePackages: ['@faura-farmer/config', '@faura-farmer/database', '@faura-farmer/types'],
  serverExternalPackages: ['@prisma/client'],
  webpack: (config, { isServer }) => {
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
  async headers() {
    const headers = [
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              key: 'Content-Security-Policy',
              value:
                "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https://lh3.googleusercontent.com https://platform-lookaside.fbsbx.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
            },
          ]
        : []),
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
      ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
        : []),
    ];

    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
