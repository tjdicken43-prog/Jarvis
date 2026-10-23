import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Operator", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <span className="brand">Operator</span>
          <nav>
            <Link href="/queue">Queue</Link>
            <Link href="/do-not-email">Do not email</Link>
          </nav>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
