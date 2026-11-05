import { ImageResponse } from "next/og";

export const alt = "MSREG Gala Camera — Eight exposures. Develop at midnight.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#F4EEE1",
          padding: "60px 80px",
          fontFamily: "serif",
          position: "relative",
          color: "#1E1C1A",
        }}
      >
        {/* Outer and Inner hairline border frame */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: "1px solid rgba(30, 28, 26, 0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 32,
            right: 32,
            bottom: 32,
            border: "1px solid rgba(30, 28, 26, 0.4)",
          }}
        />

        {/* Top Header Tag */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            fontFamily: "monospace",
            fontSize: 16,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#5E5A54",
            paddingBottom: 24,
            borderBottom: "1px solid rgba(30, 28, 26, 0.2)",
          }}
        >
          <span>EDITION NO. 1974</span>
          <span style={{ color: "#6B2A2A", fontWeight: "bold" }}>
            MSREG CLIENT GALA
          </span>
          <span>8 EXPOSURES</span>
        </div>

        {/* Main Center Typography */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 18,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#5E5A54",
              marginBottom: 16,
            }}
          >
            Annual Client Appreciation
          </span>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 300,
              letterSpacing: "-0.02em",
              margin: 0,
              color: "#1E1C1A",
              lineHeight: 1.1,
            }}
          >
            MSREG Gala Camera
          </h1>
          <p
            style={{
              fontStyle: "italic",
              fontSize: 32,
              color: "#6B2A2A",
              marginTop: 16,
              marginBottom: 24,
            }}
          >
            Saturday, November 14, 2026
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 60,
                height: 1,
                backgroundColor: "rgba(30, 28, 26, 0.3)",
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#5E5A54",
              }}
            >
              Eight exposures. Develop at midnight.
            </span>
            <div
              style={{
                width: 60,
                height: 1,
                backgroundColor: "rgba(30, 28, 26, 0.3)",
              }}
            />
          </div>
        </div>

        {/* Footer Program Colophon */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            fontFamily: "monospace",
            fontSize: 14,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#5E5A54",
            paddingTop: 24,
            borderTop: "1px solid rgba(30, 28, 26, 0.2)",
          }}
        >
          Instant Emulsion Process • Client Appreciation Program
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
