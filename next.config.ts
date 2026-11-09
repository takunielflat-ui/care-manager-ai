import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 古いアドレスから正式なドメインへ転送する。プレビュー用のURLは host が違うので対象外。
      {
        source: "/:path*",
        has: [{ type: "host", value: "care-manager-ai.vercel.app" }],
        destination: "https://caremane-ai.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
