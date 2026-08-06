import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balling Hockey — Wholesale Portal",
  description: "Wholesale order portal for Balling Hockey distributors and retailers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-neutral-50">
        <nav className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <a href="/catalog" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-full.png"
              alt="Balling Hockey"
              className="h-8 w-auto object-contain"
            />
          </a>
          <span className="text-xs text-neutral-400 hidden sm:block">Wholesale Portal</span>
        </nav>
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
