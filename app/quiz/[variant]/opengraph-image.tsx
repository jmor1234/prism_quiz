import { ImageResponse } from "next/og";
import { getVariant } from "@/lib/quiz/variants";

export const runtime = "edge";
export const alt = "Prism Health Assessment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant: slug } = await params;
  const config = getVariant(slug);

  const title = config?.name ?? "Health Assessment";
  const subtitle = config?.subtitle ?? config?.description ?? "";

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
          backgroundColor: "#262624",
          padding: "60px 80px",
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"}/25.png`}
          alt=""
          width={140}
          height={140}
          style={{ marginBottom: 36, borderRadius: "50%" }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: 26,
              color: "#C9A36A",
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: 800,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#C9A36A",
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
            }}
          >
            Prism Health
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
