"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, HelpCircle, User as UserIcon, X, LogOut, Book, Star } from "lucide-react";
import { useAuth } from "@/app/providers";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useEffect } from "react";

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * モバイル用メニューコンポーネント（ボトムシート形式）
 * Figmaデザイン: https://www.figma.com/design/Ws14gkoX2at3X9IE60nZtr/sideber?node-id=47-643
 */
export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
    const router = useRouter();
    const { user, logout } = useAuth();

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
        return () => {
            document.body.style.overflow = "auto";
        };
    }, [isOpen]);

    const handleLogout = () => {
        if (typeof window !== "undefined") {
            const ok = window.confirm("ログアウトしますか？");
            if (!ok) return;
        }
        logout();
        router.push("/auth/login");
        onClose();
    };

    if (!user) return null;

    return (
        <>
            {/* バックドロップ */}
            {isOpen && (
                <div
                    className="fixed inset-0 top-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* メニューボトムシート */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 z-40 w-full rounded-t-[24px] bg-white shadow-[0px_-4px_24px_rgba(0,0,0,0.12)] transition-transform duration-300 md:hidden",
                    isOpen ? "translate-y-0" : "translate-y-full"
                )}
            >
                {/* ドラッグハンドル */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="h-1 w-10 rounded-full bg-slate-300" />
                </div>

                {/* メニュー内容 */}
                <div className="flex max-h-[calc(100vh-200px)] flex-col gap-4 overflow-y-auto px-6 py-6">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">メニュー</h2>
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="メニューを閉じる"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* メニューカード（グラデーション背景） */}
                    <div className="rounded-3xl bg-slate-100 p-6">
                        {/* メニュー項目 */}
                        <MenuItems onClose={onClose} />
                    </div>

                    {/* アカウントカード */}
                    <AccountCard user={user} onLogout={handleLogout} />
                </div>
            </div>
        </>
    );
}

/**
 * メニュー項目
 */
function MenuItems({ onClose }: { onClose: () => void }) {
    const { user } = useAuth();

    const menuItems: Array<{
        label: string;
        href: string;
        icon: ReactNode;
        show: boolean;
    }> = [
            {
                label: "授業を作成",
                href: "/assignments?view=create",
                icon: <Book className="h-5 w-5" />,
                show: user?.role === "teacher",
            },
            {
                label: "TAリクエスト",
                href: "/ta/requests",
                icon: <Star className="h-5 w-5" />,
                show: user?.is_ta === true,
            },
            {
                label: "マイページ",
                href: "/mypage",
                icon: <UserIcon className="h-5 w-5" />,
                show: user?.role === "student",
            },
            {
                label: "設定",
                href: "/settings",
                icon: <Settings className="h-5 w-5" />,
                show: true,
            },
            {
                label: "使い方",
                href: "/tutorial",
                icon: <HelpCircle className="h-5 w-5" />,
                show: true,
            },
        ];

    return (
        <nav className="flex flex-col gap-0">
            {menuItems.filter(item => item.show).map((item, index) => (
                <div key={item.href}>
                    <Link
                        href={item.href}
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-white hover:text-slate-900"
                    >
                        <div className="flex h-5 w-5 items-center justify-center text-slate-600">
                            {item.icon}
                        </div>
                        <span className="font-medium">{item.label}</span>
                    </Link>
                    {index < menuItems.filter(m => m.show).length - 1 && (
                        <div className="mx-4 h-px bg-black/5" />
                    )}
                </div>
            ))}
        </nav>
    );
}

/**
 * アカウント情報カード
 */
function AccountCard({
    user,
    onLogout,
}: {
    user: ReturnType<typeof useAuth>["user"];
    onLogout: () => void;
}) {
    return (
        <div className="flex h-[84px] shrink-0 items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundImage: "linear-gradient(135deg, rgb(43, 127, 255) 0%, rgb(0, 201, 80) 100%)" }}
                >
                    <span className="text-[15px]">{user?.name.slice(0, 1)}</span>
                </div>
                <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 truncate text-sm font-medium text-slate-700">
                        <span className="truncate" title={user?.name}>{user?.name}</span>
                        {user?.is_ta && (
                            <span className="shrink-0 text-amber-500" title="ティーチングアシスタント">
                                TA⭐
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        {user?.role === "student" ? (
                            <>
                                <span className="truncate max-w-[80px]" title={user?.title}>{user?.title}</span>
                                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-900">
                                    {user?.rank}
                                </span>
                            </>
                        ) : (
                            <span>{user?.role}</span>
                        )}
                    </div>
                    {user?.role !== "teacher" && (
                        <div className="text-[11px] text-slate-500">
                            credits: {user?.credits ?? 0}
                        </div>
                    )}
                </div>
            </div>

            {/* ログアウトボタン */}
            <button
                onClick={onLogout}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                title="ログアウト"
                aria-label="ログアウト"
            >
                <LogOut className="h-4 w-4" />
            </button>
        </div>
    );
}
