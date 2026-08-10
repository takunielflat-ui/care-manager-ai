import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Care Manager AI",
    short_name: "ケアマネAI",
    description: "訪問記録から第5表（居宅介護支援経過）を作成します。",
    start_url: "/",
    display: "standalone",
    background_color: "#115E59",
    theme_color: "#0F766E",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
