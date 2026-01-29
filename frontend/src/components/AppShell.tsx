"use client";

import { useAuth } from "@/app/providers";
import { NavBar } from "@/components/NavBar";
import { Sidebar } from "@/components/Sidebar";
import { Book } from "lucide-react";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    // 未ログイン時はNavBar（ログインボタン等）のみ表示、または何も表示しない方針ならnull
    // ここでは要件「ログインしている状態でのみナビゲーションバーが見れる」に従い、
    // 未ログイン時はレイアウトなし（コンテンツのみ＝ログイン画面等）または
    // 最小限のヘッダーを表示するかだが、まずは既存NavBarをSP/未ログイン兼用として残しつつ
    // PCログイン済みの場合のみSidebarを表示する構成にする。

    if (!user) {
        // 未ログイン時は既存のNavBar（の未ログイン状態）を表示
        return (
            <div className="min-h-screen bg-background">
                <NavBar />
                <main className="mx-auto w-full max-w-5xl px-4 py-8">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            {/* モバイル用ヘッダー */}
            <header className="fixed left-0 right-0 top-0 z-10 bg-white px-6 py-4 md:hidden">
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <Book className="h-5 w-5" />
                    </div>
                    <span className="text-[17px] font-bold text-slate-900">Peer Review</span>
                </Link>
            </header>

            <main className="mx-auto w-full px-4 pb-24 pt-20 md:pb-8 md:pt-12 md:pl-[354px] md:pr-6 md:max-w-7xl">
                {children}
            </main>
        </div>
    );
}
