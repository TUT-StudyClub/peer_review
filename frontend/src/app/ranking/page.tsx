"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/app/providers";
import {
    apiGetAverageCreditSeries,
    apiGetAverageScoreHistory,
    apiGetMetricAverage,
    apiGetMetricAverageSeries,
    apiGetRanking,
    apiGetUsersCreditHistory,
    formatApiError,
} from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RankingCreditTrendChart } from "@/components/RankingCreditTrendChart";
import type {
    AverageSeriesPoint,
    CreditHistoryPublic,
    MetricHistoryPoint,
    UserRankingEntry,
    RankingPeriod,
    RankingMetric,
} from "@/lib/types";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";

export default function RankingPage() {
    const { token, user } = useAuth();
    const [rankings, setRankings] = useState<UserRankingEntry[]>([]);
    const [period, setPeriod] = useState<RankingPeriod>("total");
    const [metric, setMetric] = useState<RankingMetric>("credits");
    const [limit, setLimit] = useState(10);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [trendHistory, setTrendHistory] = useState<CreditHistoryPublic[]>([]);
    const [metricSeries, setMetricSeries] = useState<MetricHistoryPoint[]>([]);
    const [averageValue, setAverageValue] = useState<number | null>(null);
    const [averageSeries, setAverageSeries] = useState<AverageSeriesPoint[]>([]);
    const [trendLoading, setTrendLoading] = useState(false);
    const [trendError, setTrendError] = useState<string | null>(null);
    const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
    const trendRequestId = useRef(0);

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

    const trendUsers = useMemo(() => rankings.slice(0, 3), [rankings]);

    useEffect(() => {
        const requestId = ++trendRequestId.current;
        const applyIfLatest = (fn: () => void) => {
            if (trendRequestId.current === requestId) {
                fn();
            }
        };

        if (!token || trendUsers.length === 0) {
            applyIfLatest(() => {
                setTrendHistory([]);
                setMetricSeries([]);
                setAverageValue(null);
                setAverageSeries([]);
                setTrendError(null);
                setTrendLoading(false);
            });
            return;
        }

        setTrendLoading(true);
        setTrendError(null);

        const ids = trendUsers.map((entry) => entry.id);
        const historyPromise = apiGetUsersCreditHistory(token, ids, 120);
        const metricSeriesPromise =
            metric === "average_score"
                ? apiGetAverageScoreHistory(token, ids, period)
                : Promise.resolve<MetricHistoryPoint[]>([]);
        const averageValuePromise = apiGetMetricAverage(token, metric, period);
        const averageSeriesPromise =
            metric === "credits"
                ? apiGetAverageCreditSeries(token, period)
                : apiGetMetricAverageSeries(token, metric, period);

        Promise.allSettled([
            historyPromise,
            metricSeriesPromise,
            averageValuePromise,
            averageSeriesPromise,
        ])
            .then((results) => {
                const [historyResult, metricSeriesResult, averageValueResult, averageSeriesResult] = results;
                let firstError: unknown | null = null;

                if (historyResult.status === "fulfilled") {
                    applyIfLatest(() => setTrendHistory(historyResult.value));
                } else {
                    firstError = firstError ?? historyResult.reason;
                    applyIfLatest(() => setTrendHistory([]));
                }

                if (metricSeriesResult.status === "fulfilled") {
                    applyIfLatest(() => setMetricSeries(metricSeriesResult.value));
                } else {
                    firstError = firstError ?? metricSeriesResult.reason;
                    applyIfLatest(() => setMetricSeries([]));
                }

                if (averageValueResult.status === "fulfilled") {
                    applyIfLatest(() => setAverageValue(averageValueResult.value));
                } else {
                    firstError = firstError ?? averageValueResult.reason;
                    applyIfLatest(() => setAverageValue(null));
                }

                if (averageSeriesResult.status === "fulfilled") {
                    applyIfLatest(() => setAverageSeries(averageSeriesResult.value));
                } else {
                    firstError = firstError ?? averageSeriesResult.reason;
                    applyIfLatest(() => setAverageSeries([]));
                }

                if (firstError) {
                    applyIfLatest(() => setTrendError(formatApiError(firstError)));
                }
            })
            .finally(() => {
                applyIfLatest(() => setTrendLoading(false));
            });
    }, [token, trendUsers, period, metric]);

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
        const color = colorMap[rank];

        if (!color) {
            if (process.env.NODE_ENV !== "production") {
                console.warn(`[RankingPage] getRankBadgeColor に未知の rank が渡されました: "${rank}"`);
            }
            return "bg-gray-100 text-gray-800 border-gray-300";
        }

        return color;
    };

    const metricLabels: Record<RankingMetric, string> = {
        credits: "credit",
        review_count: "レビューの提出数",
        average_score: "平均評価スコア",
        helpful_reviews: "役立つレビュー数",
    };

    const periodOptions: { value: RankingPeriod; label: string }[] = [
        { value: "total", label: "全期間" },
        { value: "monthly", label: "月間" },
        { value: "weekly", label: "週間" },
    ];

    const metricOptions: { value: RankingMetric; label: string }[] = [
        { value: "credits", label: metricLabels.credits },
        { value: "review_count", label: metricLabels.review_count },
        { value: "average_score", label: metricLabels.average_score },
        { value: "helpful_reviews", label: metricLabels.helpful_reviews },
    ];

    const isCreditsMetric = metric === "credits";

    const metricValue = useCallback((entry: UserRankingEntry) => {
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
    }, [metric, period]);

    const metricValueLabel = () => {
        if (metric === "credits") {
            return period === "total" ? "総合クレジット" : "期間内クレジット";
        }
        return period === "total" ? metricLabels[metric] : `${metricLabels[metric]}（期間内）`;
    };

    const trendChartUsers = useMemo(
        () => trendUsers.map((entry) => ({ id: entry.id, name: entry.name })),
        [trendUsers]
    );

    const trendMetricValues = useMemo(() => {
        if (metric === "credits") return undefined;
        const valueMap: Record<string, number | null> = {};
        for (const entry of trendUsers) {
            const source =
                rankings.find((item) => item.id === entry.id);
            valueMap[entry.id] = source ? metricValue(source) : null;
        }
        return valueMap;
    }, [metric, rankings, trendUsers, metricValue]);

    const formatCount = (value?: number | null) => (value == null ? "—" : value.toLocaleString());
    const formatScore = (value?: number | null) => (value == null ? "—" : value.toFixed(1));
    const formatCourses = (values?: string[] | null) => {
        if (!values || values.length === 0) return ["未設定"];
        const cleaned = values
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0);

        if (cleaned.length === 0) {
            if (process.env.NODE_ENV !== "production") {
                console.warn("formatCourses: 無効なコースデータを検出しました", { originalValues: values });
            }
            return ["未設定"];
        }

        const unique = Array.from(new Set(cleaned));
        return unique;
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
                            <option value={3}>3件</option>
                            <option value={5}>5件</option>
                            <option value={10}>10件</option>
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
                                tabIndex={0}
                                onMouseEnter={() => setHoveredUserId(entry.id)}
                                onMouseLeave={() => setHoveredUserId((prev) => (prev === entry.id ? null : prev))}
                                className={`relative bg-white border rounded-lg p-4 transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                                    index < 3 ? "border-primary/30 shadow-sm" : "border-gray-200"
                                }`}
                            >
                                {hoveredUserId === entry.id && (
                                    <div
                                        className="pointer-events-none absolute left-0 top-1/2 z-20 w-72 -translate-x-full -translate-y-1/2 pr-3"
                                    >
                                        <div className="rounded-xl border border-black/15 bg-white p-3 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    ユーザー情報
                                                </div>
                                                <div className="text-[11px] font-medium text-gray-400">
                                                    #{index + 1}
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                <div className="text-xs text-gray-500">Credit数</div>
                                                <div className="text-right font-semibold text-gray-900">
                                                    {formatCount(entry.credits)}
                                                </div>
                                                <div className="text-xs text-gray-500">レビュー件数</div>
                                                <div className="text-right font-semibold text-gray-900">
                                                    {formatCount(entry.review_count)}
                                                </div>
                                                <div className="text-xs text-gray-500">平均スコア</div>
                                                <div className="text-right font-semibold text-gray-900">
                                                    {formatScore(entry.average_score)}
                                                </div>
                                            </div>
                                            <div className="my-3 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                                            <div className="text-xs text-gray-500">評価対象コース</div>
                                            <div className="mt-1 space-y-1">
                                                {formatCourses(entry.target_course_titles ?? []).map((course) => (
                                                    <div key={course} className="text-sm font-medium text-gray-900 truncate">
                                                        {course}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rotate-45 border border-black/15 bg-white shadow-sm"></div>
                                    </div>
                                )}
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

                <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-foreground">ランキングトレンド</h2>
                        <p className="text-sm text-muted-foreground">
                            {isCreditsMetric
                                ? "選択中のランキング上位3名と自分のクレジット推移"
                                : `選択中のランキング上位3名と自分の${metricLabels[metric]}比較`}
                        </p>
                    </div>
                    {!token ? (
                        <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                            トレンドグラフはログイン後に表示されます。
                        </div>
                    ) : trendLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : trendError ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            {trendError}
                        </div>
                    ) : trendChartUsers.length === 0 ? (
                        <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                            表示できるユーザーがいません。
                        </div>
                    ) : (
                        <div className="h-72">
                            <RankingCreditTrendChart
                                users={trendChartUsers}
                                histories={trendHistory}
                                currentUserId={user?.id}
                                period={period}
                                metric={metric}
                                metricValues={trendMetricValues}
                                metricSeries={metricSeries}
                                averageValue={averageValue}
                                averageSeries={averageSeries}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
