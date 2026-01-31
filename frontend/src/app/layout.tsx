import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Encode_Sans } from "next/font/google";
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

const encodeSans = Encode_Sans({
  variable: "--font-encode-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Peer Review",
  description: "匿名ピアレビュー（Peer Review）",
  icons: {
    icon: "/icon.png", // src/app/icon.png を参照
    apple: "/apple-icon.png", // iphoneホーム画面用アイコン
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${encodeSans.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <AuthProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <AppShell>
              <Suspense fallback={<div className="flex min-h-full flex-1 flex-col page-transition">{children}</div>}>
                <PageTransition>{children}</PageTransition>
              </Suspense>
            </AppShell>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
