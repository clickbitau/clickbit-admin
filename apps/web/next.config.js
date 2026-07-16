/** @type {import('next').NextConfig} */
const nextConfig = {
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
        destination: `${process.env.API_BASE_URL || 'http://localhost:5001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
