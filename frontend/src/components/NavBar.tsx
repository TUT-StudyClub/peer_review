"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

import { useAuth } from "@/app/providers";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-3 py-2 text-sm transition",
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("ログアウトしますか？");
      if (!ok) return;
    }
    logout();
    router.push("/auth/login");
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Peer Review
          </Link>
          <nav className="flex items-center gap-1">
            {user?.role === "teacher" ? <NavLink href="/assignments" label="課題" /> : null}
            {user?.role === "student" ? <NavLink href="/mypage" label="マイページ" /> : null}
            {user?.is_ta ? <NavLink href="/ta/requests" label="TAリクエスト" /> : null}
            {user ? <NavLink href="/settings" label="設定" /> : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{user.name}</span>
                  {user.role !== "teacher" ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{user.title}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                  {user.role !== "teacher" ? (
                    <>
                      <span>ランク: {user.rank}</span>
                      <span>credits: {user.credits}</span>
                    </>
                  ) : null}
                  <span>{user.role}</span>
                  {user.is_ta ? <span className="text-amber-600">TA⭐</span> : null}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                ログアウト
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink href="/auth/login" label="ログイン" />
              <NavLink href="/auth/register" label="新規登録" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
