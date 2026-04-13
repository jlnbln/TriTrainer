import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Cache static assets (fonts, images, icons) for 1 year
        source: '/favicon/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
