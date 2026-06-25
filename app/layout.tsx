import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balling Hockey — Portal Mayorista",
  description: "Portal de pedidos para distribuidores y retailers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
