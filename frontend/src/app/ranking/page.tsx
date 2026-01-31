"use client";

import { useState, useEffect } from "react";
import { apiGetRanking } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UserRankingEntry, RankingPeriod, RankingMetric } from "@/lib/types";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";

export default function RankingPage() {
    const [rankings, setRankings] = useState<UserRankingEntry[]>([]);
    const [period, setPeriod] = useState<RankingPeriod>("total");
    const [metric, setMetric] = useState<RankingMetric>("credits");
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await apiGetRanking(limit, period, metric);
                setRankings(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "ランキングの取得に失敗しました");
            } finally {
                setLoading(false);
            }
        };

        fetchRankings();
    }, [period, limit, metric]);

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

    const metricLabels: Record<RankingMetric, string> = {
        credits: "credit",
        review_count: "レビューの提出数",
        average_score: "平均評価スコア",
        helpful_reviews: "役立つレビュー数",
    };

    const periodOptions: { value: RankingPeriod; label: string }[] = [
        { value: "total", label: "全期間" },
        { value: "monthly", label: "一か月" },
        { value: "weekly", label: "一週間" },
    ];

    const metricOptions: { value: RankingMetric; label: string }[] = [
        { value: "credits", label: metricLabels.credits },
        { value: "review_count", label: metricLabels.review_count },
        { value: "average_score", label: metricLabels.average_score },
        { value: "helpful_reviews", label: metricLabels.helpful_reviews },
    ];

    const isCreditsMetric = metric === "credits";

    const metricValue = (entry: UserRankingEntry) => {
        if (metric === "credits") {
            return period === "total" ? entry.credits : entry.period_credits ?? 0;
        }
        if (metric === "review_count") {
            return entry.review_count ?? 0;
        }
        if (metric === "average_score") {
            return entry.average_score ?? 0;
        }
        return entry.helpful_reviews ?? 0;
    };

    const metricValueLabel = () => {
        if (metric === "credits") {
            return period === "total" ? "総合クレジット" : "期間内クレジット";
        }
        return period === "total" ? metricLabels[metric] : `${metricLabels[metric]}（期間内）`;
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
                <div className="mb-6 flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <div className="text-sm font-semibold text-gray-700">時間軸</div>
                        <Tabs value={period} onValueChange={(value) => setPeriod(value as RankingPeriod)}>
                            <TabsList className="grid w-full grid-cols-3">
                                {periodOptions.map((option) => (
                                    <TabsTrigger key={option.value} value={option.value}>
                                        {option.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="text-sm font-semibold text-gray-700">ランキング指標</div>
                        <Tabs value={metric} onValueChange={(value) => setMetric(value as RankingMetric)}>
                            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                                {metricOptions.map((option) => (
                                    <TabsTrigger key={option.value} value={option.value}>
                                        {option.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
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

                                    {/* 指標情報 */}
                                    <div className="flex-shrink-0 text-right">
                                        <div className="text-2xl font-bold text-primary">
                                            {metric === "average_score"
                                                ? metricValue(entry).toFixed(1)
                                                : metricValue(entry)}
                                        </div>
                                        <div className="text-xs text-gray-500">{metricValueLabel()}</div>
                                        {period !== "total" && metric !== "credits" && (
                                            <div className="text-xs text-gray-400 mt-1">
                                                (総合クレジット: {entry.credits})
                                            </div>
                                        )}
                                        {period !== "total" && metric === "credits" && (
                                            <div className="text-xs text-gray-400 mt-1">(総合: {entry.credits})</div>
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
                        {isCreditsMetric
                            ? "ランキングは、レビュー活動によって獲得したクレジットに基づいて算出されます。質の高いレビューを提供することで、より多くのクレジットを獲得できます。"
                            : "ランキングは選択中の指標に基づいて算出されます。"}
                    </p>
                </div>
            </div>
        </div>
    );
}
