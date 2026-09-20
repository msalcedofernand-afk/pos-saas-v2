import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  title: { default: "POS SaaS V2", template: "%s · POS SaaS V2" },
  description: "Sistema POS para restaurantes: pedidos, cocina, caja, mesas e inventario.",
  applicationName: "POS SaaS V2",
  keywords: ["POS restaurante", "sistema de pedidos", "caja restaurante", "cocina KDS", "inventario"],
  openGraph: { type: "website", locale: "es_PE", siteName: "POS SaaS V2", title: "POS SaaS V2", description: "Opera tu restaurante con pedidos, cocina, caja e inventario." },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
