import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { env } from "@/lib/env";
import { getBusiness } from "@/lib/settings/business";
import "./globals.css";
import "./motion.css";

// Downloaded at build time and served from this origin: no request to a
// font CDN at runtime, which is also what lets the CSP stay 'self'.
const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

// Every page reads the database or a per-request nonce. Without this, Next
// would try to prerender them during `next build`, which would need a live
// database inside the Docker build stage.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusiness();
  return {
    metadataBase: new URL(env.APP_ORIGIN),
    title: { default: `${business.name} · ${business.tagline}`, template: `%s · ${business.name}` },
    description: `${business.name}: ${business.tagline}. Sigue tu reparación en línea y aprueba tu cotización desde el celular.`,
  };
}

export const viewport: Viewport = { themeColor: "#0d1117" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
