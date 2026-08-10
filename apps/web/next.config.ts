import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@faura-farmer/config', '@faura-farmer/database', '@faura-farmer/types'],
};

export default nextConfig;