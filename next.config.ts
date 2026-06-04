import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions 請求體上限 100MB (Next 15 正確位置在 serverActions 底下)
    // 註: App Router 的 route handler (app/api/*) 本來就沒 body 大小限制, 上傳不靠這個
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
