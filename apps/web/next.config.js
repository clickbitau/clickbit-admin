/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@clickbit/shared'],
  turbopack: {},
  webpack: (config) => {
    config.output.chunkLoadTimeout = 120000;
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
