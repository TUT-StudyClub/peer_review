"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiGetRanking, formatApiError } from "@/lib/api";
import type { RankingPeriod, UserRankingEntry } from "@/lib/types";

type RankingState = {
    data: UserRankingEntry[];
    loading: boolean;
    error: string | null;
};

type RankingConfig = {
    title: string;
    description: string;
    emptyMessage: string;
    creditsLabel: string;
    usePeriodCredits: boolean;
};

const rankingTabLabels: Record<RankingPeriod, string> = {
    total: "総合",
    monthly: "月間",
    weekly: "週間",
};

const rankingConfig: Record<RankingPeriod, RankingConfig> = {
    total: {
        title: "レビュアーランキング TOP5",
        description: "TA資格を満たすレビュアーの上位5名を表示します。",
        emptyMessage: "TA資格者がまだいません。",
        creditsLabel: "credits",
        usePeriodCredits: false,
    },
    monthly: {
        title: "月間ランキング TOP5",
        description: "TA資格を満たすレビュアーの直近30日間の獲得credits上位5名を表示します。",
        emptyMessage: "直近30日間のランキング対象者がいません。",
        creditsLabel: "credits",
        usePeriodCredits: true,
    },
    weekly: {
        title: "週間ランキング TOP5",
        description: "TA資格を満たすレビュアーの直近7日間の獲得credits上位5名を表示します。",
        emptyMessage: "直近7日間のランキング対象者がいません。",
        creditsLabel: "credits",
        usePeriodCredits: true,
    },
};

const rankingPeriods: RankingPeriod[] = ["total", "monthly", "weekly"];

export default function StartPage() {
    const [activePeriod, setActivePeriod] = useState<RankingPeriod>("total");
    const [rankings, setRankings] = useState<Record<RankingPeriod, RankingState>>({
        total: { data: [], loading: false, error: null },
        monthly: { data: [], loading: false, error: null },
        weekly: { data: [], loading: false, error: null },
    });

    const loadRanking = useCallback(async (period: RankingPeriod) => {
        setRankings((prev) => ({
            ...prev,
            [period]: { ...prev[period], loading: true, error: null },
        }));
        try {
            const list = await apiGetRanking(5, period);
            setRankings((prev) => ({
                ...prev,
                [period]: { data: list, loading: false, error: null },
            }));
        } catch (err) {
            setRankings((prev) => ({
                ...prev,
                [period]: { ...prev[period], loading: false, error: formatApiError(err) },
            }));
        }
    }, []);

    useEffect(() => {
        const state = rankings[activePeriod];
        if (state.loading || state.data.length > 0 || state.error) return;
        void loadRanking(activePeriod);
    }, [activePeriod, rankings, loadRanking]);

    const config = rankingConfig[activePeriod];
    const state = rankings[activePeriod];
    const displayCredits = (entry: UserRankingEntry) =>
        config.usePeriodCredits ? entry.period_credits ?? 0 : entry.credits;

    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-white p-6">
                <h1 className="text-2xl font-semibold">Peer Review（匿名ピアレビュー）</h1>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        href="/assignments"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                    >
                        課題一覧へ
                    </Link>
                    <Link
                        href="/auth/login"
                        className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        ログイン
                    </Link>
                    <Link
                        href="/auth/register"
                        className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        新規登録
                    </Link>
                </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
                <h2 className="text-lg font-semibold">まず何をすればいい？</h2>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-black">
                    <li>teacher でログインして課題＋ルーブリックを作る</li>
                    <li>student が提出（Markdown推奨）</li>
                    <li>student が「次のレビュー」を取得してレビュー提出</li>
                    <li>提出者がレビューをメタ評価</li>
                    <li>成績（Grade）を確認</li>
                </ol>
            </div>

            <div className="rounded-xl border bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">{config.title}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
                    </div>
                    <button
                        onClick={() => void loadRanking(activePeriod)}
                        className="rounded-md border px-3 py-1 text-xs hover:bg-slate-50"
                    >
                        更新
                    </button>
                </div>

                <div className="mt-4 inline-flex flex-wrap gap-2 rounded-full bg-slate-100 p-1">
                    {rankingPeriods.map((period) => {
                        const isActive = period === activePeriod;
                        return (
                            <button
                                key={period}
                                type="button"
                                onClick={() => setActivePeriod(period)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                    isActive
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:bg-slate-200"
                                }`}
                                aria-pressed={isActive}
                            >
                                {rankingTabLabels[period]}
                            </button>
                        );
                    })}
                </div>

                {state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
                {state.loading ? (
                    <p className="mt-3 text-sm text-muted-foreground">読み込み中...</p>
                ) : null}
                {!state.loading && state.data.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">{config.emptyMessage}</p>
                ) : null}

                {state.data.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                        {state.data.map((u, index) => (
                            <li key={u.id} className="rounded-lg border border-slate-200 px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-semibold text-slate-900">
                                            #{index + 1}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">{u.name}</span>
                                                {u.is_ta ? (
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">
                                                        TA
                                                    </span>
                                                ) : null}
                                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                                                    {u.title}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                ランク: {u.rank}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold">
                                            {displayCredits(u)} {config.creditsLabel}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </div>
    );
}
