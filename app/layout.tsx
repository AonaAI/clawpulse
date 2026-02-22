import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClawPulse — Agent Operations",
  description: "Monitor and manage your AI agent network",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#11021d" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ClawPulse" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('cp-theme');
              if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
            } catch(e){}
          })();
        `}} />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}} />
      </head>
      <body className="antialiased" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
