import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers";
import { NavBar } from "@/components/NavBar";
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
          <Suspense fallback={<div className="h-14 border-b border-border bg-background" />}>
            <NavBar />
          </Suspense>
          <main className="mx-auto w-full max-w-5xl px-4 py-8">
            <Suspense fallback={<div className="page-transition">{children}</div>}>
              <PageTransition>{children}</PageTransition>
            </Suspense>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
