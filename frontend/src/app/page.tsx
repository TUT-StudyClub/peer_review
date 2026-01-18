import Link from "next/link";
import { Award, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Users,
    title: "匿名でレビュー",
    description: "お互いを知らないからこそ、率直で建設的なフィードバックが可能です。",
    iconClassName: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: ShieldCheck,
    title: "安全な環境",
    description: "ガイドラインと報告フローで、健全なコミュニティを維持します。",
    iconClassName: "bg-sky-100 text-sky-700",
  },
  {
    icon: Award,
    title: "スキル向上",
    description: "レビューを通じて、あなた自身のスキルと視野を広げられます。",
    iconClassName: "bg-amber-100 text-amber-700",
  },
  {
    icon: TrendingUp,
    title: "成長を追跡",
    description: "クレジットとランクで、成長の変化をひと目で確認できます。",
    iconClassName: "bg-slate-100 text-slate-700",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-24">
      <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-[100vw] overflow-hidden bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-sky-50 via-white to-emerald-50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/50 blur-3xl motion-safe:animate-[float-slow_12s_ease-in-out_infinite]" />
          <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 rounded-full bg-sky-200/50 blur-3xl motion-safe:animate-[float-slow_10s_ease-in-out_infinite] motion-safe:[animation-delay:-3s]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl motion-safe:animate-[fade-up_0.6s_ease-out_both] motion-safe:[animation-delay:120ms]">
              Peer Review
            </h1>
            <p className="mt-6 text-lg text-slate-600 sm:text-xl motion-safe:animate-[fade-up_0.6s_ease-out_both] motion-safe:[animation-delay:200ms]">
              互いに学び、成長するための匿名ピアレビュープラットフォーム
              <br className="hidden sm:block" />
              安心して学び合える場を、あなたのペースで
            </p>
            <div className="mt-10 flex justify-center motion-safe:animate-[fade-up_0.6s_ease-out_both] motion-safe:[animation-delay:280ms]">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-slate-900 px-10 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
              >
                <Link href="/auth/login">始める</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-12">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            なぜ Peer Review を選ぶのか
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
            安全で効果的な学習環境で、お互いに成長できるサイクルをつくります
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-safe:animate-[fade-up_0.6s_ease-out_both]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconClassName}`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mb-8 w-[100vw] bg-slate-950 text-slate-500">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-xs">
          &copy; 2026 Peer Review. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
