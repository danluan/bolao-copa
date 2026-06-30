import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolao Copa 2026",
  description: "Dashboard do bolao com ranking e resultados oficiais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
