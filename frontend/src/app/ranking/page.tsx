"use client";

import { useState, useEffect } from "react";
import { apiGetRanking } from "@/lib/api";
import type { UserRankingEntry, RankingPeriod } from "@/lib/types";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";

export default function RankingPage() {
    const [rankings, setRankings] = useState<UserRankingEntry[]>([]);
    const [period, setPeriod] = useState<RankingPeriod>("total");
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await apiGetRanking(limit, period);
                setRankings(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "ランキングの取得に失敗しました");
            } finally {
                setLoading(false);
            }
        };

        fetchRankings();
    }, [period, limit]);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="h-6 w-6 text-yellow-500" />;
        if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
        if (index === 2) return <Award className="h-6 w-6 text-amber-700" />;
        return <div className="h-6 w-6 flex items-center justify-center text-sm font-semibold text-gray-600">{index + 1}</div>;
    };

    const getRankBadgeColor = (rank: string) => {
        const colorMap: Record<string, string> = {
            bronze: "bg-amber-100 text-amber-800 border-amber-300",
            silver: "bg-gray-100 text-gray-800 border-gray-300",
            gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
            platinum: "bg-cyan-100 text-cyan-800 border-cyan-300",
            diamond: "bg-blue-100 text-blue-800 border-blue-300",
        };
        return colorMap[rank] || "bg-gray-100 text-gray-800 border-gray-300";
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* ヘッダー */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">ランキング</h1>
                    </div>
                    <p className="text-gray-600">レビュー活動に基づくユーザーランキング</p>
                </div>

                {/* フィルターコントロール */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setPeriod("total")}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                period === "total"
                                    ? "bg-primary text-white"
                                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                            総合
                        </button>
                        <button
                            onClick={() => setPeriod("monthly")}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                period === "monthly"
                                    ? "bg-primary text-white"
                                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                            月間
                        </button>
                        <button
                            onClick={() => setPeriod("weekly")}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                period === "weekly"
                                    ? "bg-primary text-white"
                                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                            週間
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <label htmlFor="limit" className="text-sm font-medium text-gray-700">
                            表示件数:
                        </label>
                        <select
                            id="limit"
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value={5}>5件</option>
                            <option value={10}>10件</option>
                            <option value={20}>20件</option>
                            <option value={50}>50件</option>
                        </select>
                    </div>
                </div>

                {/* ランキング表示 */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                        {error}
                    </div>
                ) : rankings.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
                        ランキングデータがありません
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rankings.map((entry, index) => (
                            <div
                                key={entry.id}
                                className={`bg-white border rounded-lg p-4 transition-all hover:shadow-md ${
                                    index < 3 ? "border-primary/30 shadow-sm" : "border-gray-200"
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* 順位アイコン */}
                                    <div className="flex-shrink-0 w-10 flex justify-center">
                                        {getRankIcon(index)}
                                    </div>

                                    {/* ユーザー情報 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                                                {entry.name}
                                            </h3>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRankBadgeColor(
                                                        entry.rank
                                                    )}`}
                                                >
                                                    {entry.title}
                                                </span>
                                                {entry.is_ta && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                                                        TA
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* クレジット情報 */}
                                    <div className="flex-shrink-0 text-right">
                                        <div className="text-2xl font-bold text-primary">
                                            {period === "total" ? entry.credits : entry.period_credits ?? 0}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {period === "total" ? "総合クレジット" : "期間内クレジット"}
                                        </div>
                                        {period !== "total" && (
                                            <div className="text-xs text-gray-400 mt-1">
                                                (総合: {entry.credits})
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 説明文 */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">ランキングについて</h3>
                    <p className="text-sm text-blue-800">
                        ランキングは、レビュー活動によって獲得したクレジットに基づいて算出されます。
                        質の高いレビューを提供することで、より多くのクレジットを獲得できます。
                    </p>
                </div>
            </div>
        </div>
    );
}
