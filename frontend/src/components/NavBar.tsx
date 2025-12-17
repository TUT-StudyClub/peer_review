"use client";

import Link from "next/link";
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
        active ? "bg-indigo-600 text-white" : "text-black hover:bg-slate-200",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            pure-review
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/assignments" label="課題" />
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-sm text-black sm:block">
                {user.name}（{user.role} / credits: {user.credits}）
              </div>
              <button
                onClick={logout}
                className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
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

