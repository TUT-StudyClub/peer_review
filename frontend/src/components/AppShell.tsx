"use client";

import { useAuth } from "@/app/providers";
import { NavBar } from "@/components/NavBar";
import { Sidebar } from "@/components/Sidebar";

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
            <div className="flex min-h-screen flex-col bg-background">
                <NavBar />
                <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Sidebar />

            <div className="md:hidden">
                <NavBar />
            </div>

            <main className="mx-auto flex w-full flex-1 flex-col px-4 py-8 md:pl-[354px] md:pr-6 md:pt-12 md:max-w-7xl">
                {children}
            </main>
        </div>
    );
}
