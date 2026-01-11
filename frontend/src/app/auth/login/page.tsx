"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { useAuth } from "@/app/providers";
import { ErrorMessages } from "@/components/ErrorMessages";
import { formatApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password, rememberMe);
      router.push("/assignments");
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4">
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.55)] sm:p-10">
        <div className="pointer-events-none absolute -top-20 left-8 h-36 w-36 rounded-full bg-sky-100 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-8 h-40 w-40 rounded-full bg-emerald-100 blur-3xl" />

        <div className="relative space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">ログイン</h1>
            <p className="text-base text-slate-500 sm:text-lg">アカウントにログインして始めましょう</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">メールアドレス</label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/10">
                <Mail className="h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="your@email.com"
                  className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">パスワード</label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/10">
                <Lock className="h-5 w-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="rounded-full p-1 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
                />
                ログイン状態を保持
              </label>
              <button type="button" className="text-sky-600 transition hover:text-sky-700">
                パスワードを忘れた？
              </button>
            </div>

            {error ? (
              <div className="whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <ErrorMessages message={error} />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.75)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ログイン
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            または
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <p className="text-center text-sm text-slate-600">
            アカウントをお持ちでない方は{" "}
            <Link className="font-semibold text-sky-600 transition hover:text-sky-700" href="/auth/register">
              新規登録
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
