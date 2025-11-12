import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 增加 API 路由的請求體大小限制到 100MB
    bodySizeLimit: '100mb',
  },
};

export default nextConfig;
