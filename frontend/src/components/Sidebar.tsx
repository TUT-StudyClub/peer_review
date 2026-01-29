"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    Bell,
    Book,
    HelpCircle,
    Home,
    LogOut,
    Menu,
    Settings,
    Star,
    User as UserIcon
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./MobileMenu";
import type { ComponentType } from "react";
import { useState } from "react";

// ナビゲーションアイテムの型定義
type NavItem = {
    label: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    show: boolean;
    isActive?: (path: string) => boolean;
    className?: string;
    badge?: number;
};

/**
 * サイドバーコンポーネント (PC向けメニュー + モバイル向けボトムナビゲーション)
 * PC: Figmaデザイン https://www.figma.com/design/Ws14gkoX2at3X9IE60nZtr/sideber?node-id=11-496
 * Mobile: Figmaデザイン https://www.figma.com/design/Ws14gkoX2at3X9IE60nZtr/sideber?node-id=54-1889
 */
export function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // ナビゲーション項目定義
    // 順序: ホーム→授業一覧→通知→TAリクエスト→マイページ / 設定→使い方
    const mainNavItems: NavItem[] = [
        {
            label: "ホーム",
            href: "/home",
            icon: Home,
            show: true,
        },
        {
            label: "授業一覧",
            href: "/assignments",
            icon: Book,
            show: user?.role === "teacher" || user?.role === "student",
            isActive: (path: string) => path === "/assignments" && searchParams.get("view") !== "create",
        },
        {
            label: "授業を作成",
            href: "/assignments?view=create",
            icon: Book, // FigmaにはないのでBookで代用、必要に応じて変更
            show: user?.role === "teacher",
            isActive: (path: string) => path === "/assignments" && searchParams.get("view") === "create",
        },
        {
            label: "通知",
            href: "/notifications",
            icon: Bell,
            show: true,
            // badge: 2, // 固定値（要件により）
        },
        {
            label: "TAリクエスト",
            href: "/ta/requests",
            icon: Star,
            show: user?.is_ta === true,
            className: "text-amber-600", // アイコン色強調
        },
        {
            label: "マイページ",
            href: "/mypage",
            icon: UserIcon,
            show: user?.role === "student",
        },
    ];

    const otherNavItems: NavItem[] = [
        {
            label: "設定",
            href: "/settings",
            icon: Settings,
            show: true,
        },
        {
            label: "使い方",
            href: "/tutorial",
            icon: HelpCircle,
            show: true,
        },
    ];

    const handleLogout = () => {
        if (typeof window !== "undefined") {
            const ok = window.confirm("ログアウトしますか？");
            if (!ok) return;
        }
        logout();
        router.push("/auth/login");
    };

    if (!user) return null;

    return (
        <>
            {/* PC用サイドバー（768px以上） */}
            <PCSidebar
                pathname={pathname}
                searchParams={searchParams}
                user={user}
                logout={logout}
                mainNavItems={mainNavItems}
                otherNavItems={otherNavItems}
                handleLogout={handleLogout}
            />

            {/* モバイル用ボトムナビゲーション（768px未満） */}
            <MobileBottomNav
                pathname={pathname}
                mainNavItems={mainNavItems}
                onMenuClick={() => setIsMobileMenuOpen(true)}
            />

            {/* モバイル用メニュー（ボトムシート） */}
            <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        </>
    );
}

/**
 * PC用サイドバー
 */
function PCSidebar({
    pathname,
    searchParams,
    user,
    logout,
    mainNavItems,
    otherNavItems,
    handleLogout,
}: {
    pathname: string;
    searchParams: URLSearchParams;
    user: ReturnType<typeof useAuth>["user"];
    logout: ReturnType<typeof useAuth>["logout"];
    mainNavItems: NavItem[];
    otherNavItems: NavItem[];
    handleLogout: () => void;
}) {
    return (
        <aside className="fixed left-0 top-0 hidden h-screen w-[330px] flex-col gap-4 overflow-hidden bg-white p-6 md:flex">
            {/* 1. Logo Card */}
            <div className="flex h-20 shrink-0 items-center justify-start rounded-3xl border border-slate-200 bg-slate-50 px-5 shadow-sm">
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <Book className="h-5 w-5" />
                    </div>
                    <span className="text-[17px] font-bold text-slate-900">Peer Review</span>
                </Link>
            </div>

            {/* 2. Menu Card (Scrollable) */}
            <div className="flex w-full flex-1 flex-col gap-8 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm">
                {/* メインメニュー */}
                <div className="flex flex-col gap-3">
                    <div className="px-4 text-xs text-slate-500">メインメニュー</div>
                    <nav className="flex flex-col gap-1">
                        {mainNavItems.filter(item => item.show).map((item) => {
                            const active = item.isActive ? item.isActive(pathname) : pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
                                        active
                                            ? "bg-slate-200 text-slate-900 font-medium"
                                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                                        item.className
                                    )}
                                >
                                    <item.icon className={cn("h-4 w-4", active ? "text-slate-900" : "text-slate-400")} />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge ? (
                                        <span className="flex h-5 items-center justify-center rounded-full bg-slate-900 px-2 text-[11px] font-medium text-white">
                                            {item.badge}
                                        </span>
                                    ) : null}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* その他 */}
                <div className="flex flex-col gap-3">
                    <div className="px-4 text-xs text-slate-500">その他</div>
                    <nav className="flex flex-col gap-1">
                        {otherNavItems.filter(item => item.show).map((item) => {
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
                                        active
                                            ? "bg-slate-200 text-slate-900 font-medium"
                                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon className={cn("h-4 w-4", active ? "text-slate-900" : "text-slate-400")} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* 3. Account Card */}
            <div className="flex h-[84px] shrink-0 items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ backgroundImage: "linear-gradient(135deg, rgb(43, 127, 255) 0%, rgb(0, 201, 80) 100%)" }}
                    >
                        <span className="text-[15px]">{user.name.slice(0, 1)}</span>
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 truncate text-sm font-medium text-slate-700">
                            <span className="truncate" title={user.name}>{user.name}</span>
                            {user.is_ta && (
                                <span className="shrink-0 text-amber-500" title="ティーチングアシスタント">
                                    TA⭐
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {user.role === "student" ? (
                                <>
                                    <span className="truncate max-w-[80px]" title={user.title}>{user.title}</span>
                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-900">
                                        {user.rank}
                                    </span>
                                </>
                            ) : (
                                <span>{user.role}</span>
                            )}
                        </div>
                        {user.role !== "teacher" && (
                            <div className="text-[11px] text-slate-500">
                                credits: {user.credits ?? 0}
                            </div>
                        )}
                    </div>
                </div>

                {/* ログアウトアイコン */}
                <button
                    onClick={handleLogout}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                    title="ログアウト"
                >
                    <LogOut className="h-4 w-4" />
                </button>
            </div>
        </aside>
    );
}

/**
 * モバイル用ボトムナビゲーション
 */
function MobileBottomNav({
    pathname,
    mainNavItems,
    onMenuClick,
}: {
    pathname: string;
    mainNavItems: NavItem[];
    onMenuClick: () => void;
}) {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-slate-200 bg-white shadow-[0px_-2px_8px_rgba(0,0,0,0.04)] md:hidden">
            {mainNavItems.filter(item => item.show && isMainNavVisible(item)).map((item) => {
                const active = item.isActive ? item.isActive(pathname) : pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                            active
                                ? "text-slate-900"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <div
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1.5 transition-colors",
                                active && "bg-[#e8eef9]"
                            )}
                        >
                            <item.icon className={cn("h-6 w-6")} />
                            <span>{item.label}</span>
                        </div>
                    </Link>
                );
            })}

            {/* メニューボタン */}
            <button
                onClick={onMenuClick}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-slate-500 transition-colors hover:text-slate-700"
                aria-label="メニューを開く"
            >
                <div className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1.5">
                    <Menu className="h-6 w-6" />
                    <span>メニュー</span>
                </div>
            </button>
        </nav>
    );
}

/**
 * モバイル用ボトムナビゲーションに表示するアイテムの判定
 */
function isMainNavVisible(item: NavItem): boolean {
    // ボトムナビに表示する主要なアイテムのみ
    return ["ホーム", "授業一覧", "通知"].includes(item.label);
}
