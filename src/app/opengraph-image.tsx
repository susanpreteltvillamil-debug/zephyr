import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/data/public";

export const alt = "Salón de uñas · Reserva tu cita en línea";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function OpengraphImage() {
  const settings = await getSettings();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #2a0f45 0%, #7B2CBF 55%, #FFB5C0 100%)",
          color: "white",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 6, textTransform: "uppercase", opacity: 0.9 }}>Salón de uñas</div>
        <div style={{ fontSize: 150, fontWeight: 700, lineHeight: 1, marginTop: 16 }}>{settings.salon_name}</div>
        <div style={{ fontSize: 44, marginTop: 28, maxWidth: 900 }}>
          {settings.tagline || "Uñas impecables, cuidado de verdad"}
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignSelf: "flex-start",
            background: "white",
            color: "#3d1563",
            borderRadius: 999,
            padding: "18px 40px",
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          Reserva tu cita en línea
        </div>
      </div>
    ),
    size,
  );
}
