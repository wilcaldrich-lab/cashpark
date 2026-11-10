import { ImageResponse } from "next/og";

export const alt = "ClaimDeadline — open US class actions sorted by claim deadline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#efe4cf",
          color: "#1b140e",
          padding: "64px",
          fontFamily: "Georgia",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6 }}>
          OPEN US CLASS ACTIONS
        </div>
        <div style={{ display: "flex", fontSize: 92, lineHeight: 0.9 }}>
          ClaimDeadline
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 28,
            borderTop: "4px solid #1b140e",
            paddingTop: 24,
          }}
        >
          <span>Soonest claim deadline first</span>
          <span style={{ color: "#c43218" }}>Filing is free</span>
        </div>
      </div>
    ),
    size,
  );
}
