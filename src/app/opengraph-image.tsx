import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "MSREG Client Appreciation Gala — Vintage 1970s Instant Camera";
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
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F4EEE1",
          position: "relative",
          padding: "40px",
        }}
      >
        {/* Outer letterpress border rules */}
        <div
          style={{
            position: "absolute",
            inset: "20px",
            border: "1px solid rgba(30, 28, 26, 0.25)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "28px",
            border: "1px solid rgba(30, 28, 26, 0.45)",
            pointerEvents: "none",
          }}
        />

        {/* Top Header Tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "90%",
            fontFamily: "monospace",
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "#5E5A54",
            paddingBottom: 16,
            borderBottom: "1px solid rgba(30, 28, 26, 0.2)",
            marginBottom: 28,
          }}
        >
          <span>Edition No. 1974</span>
          <span style={{ color: "#6B2A2A", fontWeight: "bold" }}>
            MSREG Client Appreciation Gala
          </span>
          <span>8 Analog Exposures</span>
        </div>

        {/* Center content with polaroid motif */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "48px",
          }}
        >
          {/* Polaroid Frame */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backgroundColor: "#FAF7F0",
              border: "1px solid rgba(30, 28, 26, 0.35)",
              padding: "16px 16px 36px 16px",
              width: "280px",
              transform: "rotate(-2deg)",
            }}
          >
            <div
              style={{
                width: "248px",
                height: "248px",
                backgroundColor: "#1E1C1A",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#FAF7F0",
                border: "1px solid rgba(30, 28, 26, 0.5)",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  border: "2px solid rgba(250, 247, 240, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    border: "2px solid #6B2A2A",
                    backgroundColor: "rgba(107, 42, 42, 0.3)",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "rgba(250, 247, 240, 0.7)",
                }}
              >
                Cartridge No. 1974
              </span>
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 18,
                color: "#1E1C1A",
                fontStyle: "italic",
              }}
            >
              Nov 14, 2026 • Gala Night
            </div>
          </div>

          {/* Right Text Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: "520px",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.3em",
                color: "#6B2A2A",
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              1970s Instant Disposable Camera
            </span>
            <h1
              style={{
                fontSize: 52,
                fontWeight: 300,
                color: "#1E1C1A",
                lineHeight: 1.1,
                margin: 0,
                marginBottom: 16,
              }}
            >
              MSREG Gala Camera
            </h1>
            <p
              style={{
                fontSize: 20,
                fontStyle: "italic",
                color: "#5E5A54",
                margin: 0,
                marginBottom: 24,
                lineHeight: 1.4,
              }}
            >
              Eight exposures. Develop at midnight. A physical film experience for our cherished clients.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontFamily: "monospace",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#6B2A2A",
              }}
            >
              <span>• Latent Vault</span>
              <span>• Midnight Unveiling</span>
              <span>• Archival Prints</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
