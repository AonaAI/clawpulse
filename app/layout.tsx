import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClawPulse — Agent Operations",
  description: "Monitor and manage your AI agent network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="antialiased" style={{ background: '#0a0118', color: '#f8f4ff' }}>
        <div className="flex min-h-screen" style={{ background: '#0a0118' }}>
          <Sidebar />
          <main className="flex-1 overflow-auto" style={{ background: '#0a0118' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
