import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers";
import { AppShell } from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peer Review",
  description: "匿名ピアレビュー（Peer Review）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <AuthProvider>
          <AppShell>
            <Suspense fallback={<div className="page-transition">{children}</div>}>
              <PageTransition>{children}</PageTransition>
            </Suspense>
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
