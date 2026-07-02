import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8787';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    // RainbowKit / Wagmi pull optional deps not needed in the browser bundle.
    config.externals = [...(config.externals ?? []), 'pino-pretty', 'lokijs', 'encoding'];
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      { source: '/.well-known/:path*', destination: `${backendUrl}/.well-known/:path*` },
    ];
  },
};

export default nextConfig;
