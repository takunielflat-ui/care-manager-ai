import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366F1 0%, #0EA5E9 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "55%",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <svg width="272" height="272" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="2.5" width="16" height="19" rx="3" fill="white" fillOpacity="0.97" />
          <rect x="8" y="1" width="8" height="4" rx="1.5" fill="white" />
          <path
            d="M8 12.5l2.6 2.6L16 9.6"
            stroke="#0891B2"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
