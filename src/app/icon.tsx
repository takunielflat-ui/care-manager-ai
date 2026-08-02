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
          background: "linear-gradient(160deg, #0F766E 0%, #115E59 100%)",
        }}
      >
        <svg width="280" height="280" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4.5 4v-4H6a2 2 0 0 1-2-2z"
            fill="white"
          />
          <path
            d="M9 13.2V11l6-6 2.2 2.2-6 6H9z"
            fill="#0F766E"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
