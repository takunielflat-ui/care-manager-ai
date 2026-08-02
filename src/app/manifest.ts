import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Care Manager AI",
    short_name: "ケアマネAI",
    description: "訪問記録から第5表（居宅介護支援経過）を作成します。",
    start_url: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#6366F1",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
