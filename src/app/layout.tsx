import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toaster";
import { publicEnv } from "@/lib/env";
import { getSettings } from "@/lib/data/public";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display-face",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = settings.salon_name;
  const description = `${name}: salón de uñas con cita previa. Semipermanente, acrílico, poligel, dipping, press on y pedicura. Reserva en línea y asegura tu cupo con un abono.`;
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${name} · Salón de uñas | Reserva tu cita en línea`, template: `%s · ${name}` },
    description,
    applicationName: name,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: name,
      title: `${name} · Salón de uñas`,
      description,
      url: "/",
    },
    twitter: { card: "summary_large_image", title: `${name} · Salón de uñas`, description },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0911" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
