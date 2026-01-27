"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const showCourses = user?.role === "teacher" || user?.role === "student";
  const isAssignments = pathname === "/assignments";
  const isCreateView = isAssignments && searchParams.get("view") === "create";
  const courseNavClass = (active: boolean) =>
    [
      "rounded-md px-3 py-2 text-sm font-medium transition",
      active ? "bg-slate-900 text-white shadow-sm" : "text-foreground hover:bg-accent hover:text-accent-foreground",
    ].join(" ");

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
            {showCourses ? (
              <>
                <Link href="/assignments" className={courseNavClass(isAssignments && !isCreateView)}>
                  授業一覧
                </Link>
                {user?.role === "teacher" ? (
                  <Link href="/assignments?view=create" className={courseNavClass(isAssignments && isCreateView)}>
                    授業を作成
                  </Link>
                ) : null}
              </>
            ) : null}
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
