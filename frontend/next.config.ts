import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['192.168.1.4', '10.11.129.178', 'localhost', '127.0.0.1'],
};

export default nextConfig;
