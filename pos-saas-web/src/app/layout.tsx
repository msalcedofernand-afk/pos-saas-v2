import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS SaaS",
  description: "Plataforma de gestión para negocios",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
