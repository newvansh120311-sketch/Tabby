import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@tabby/core'],
  poweredByHeader: false,
};

export default config;
