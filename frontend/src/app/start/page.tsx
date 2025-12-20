"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGetRanking, formatApiError } from "@/lib/api";
import type { UserRankingEntry } from "@/lib/types";

export default function StartPage() {
    const [ranking, setRanking] = useState<UserRankingEntry[]>([]);
    const [rankingLoading, setRankingLoading] = useState(true);
    const [rankingError, setRankingError] = useState<string | null>(null);

    const loadRanking = async () => {
        setRankingLoading(true);
        setRankingError(null);
        try {
            const list = await apiGetRanking(5);
            setRanking(list);
        } catch (err) {
            setRankingError(formatApiError(err));
        } finally {
            setRankingLoading(false);
        }
    };

    useEffect(() => {
        void loadRanking();
    }, []);

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
                        <h2 className="text-lg font-semibold">レビュアーランキング TOP5</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            TA資格を満たすレビュアーの上位5名を表示します。
                        </p>
                    </div>
                    <button
                        onClick={loadRanking}
                        className="rounded-md border px-3 py-1 text-xs hover:bg-slate-50"
                    >
                        更新
                    </button>
                </div>

                {rankingError ? (
                    <p className="mt-3 text-sm text-red-600">{rankingError}</p>
                ) : null}
                {rankingLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground">読み込み中...</p>
                ) : null}
                {!rankingLoading && ranking.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">TA資格者がまだいません。</p>
                ) : null}

                {ranking.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                        {ranking.map((u, index) => (
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
                                        <div className="text-sm font-semibold">{u.credits} credits</div>
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
