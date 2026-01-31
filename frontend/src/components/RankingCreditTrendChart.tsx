"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type {
  AverageSeriesPoint,
  CreditHistoryPublic,
  MetricHistoryPoint,
  RankingMetric,
  RankingPeriod,
} from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type TrendUser = {
  id: string;
  name: string;
};

type TrendChartProps = {
  users: TrendUser[];
  histories: CreditHistoryPublic[];
  currentUserId?: string | null;
  period: RankingPeriod;
  metric: RankingMetric;
  metricValues?: Record<string, number | null>;
  metricSeries?: MetricHistoryPoint[];
  averageValue?: number | null;
  averageSeries?: AverageSeriesPoint[];
};

// X軸に表示するラベル数の上限（最大30件）。
// 週次/全期間でもデータ側で間引き・集約されることを前提に、表示負荷を抑える目的で固定値としている。
const MAX_LABELS = 30;
// 「全期間」モードで扱う最大日数レンジ（直近90日を想定）。
const TOTAL_RANGE_DAYS = 90;
const JST_OFFSET_MINUTES = 9 * 60;

const palette = [
  "#3B82F6",
  "#22C55E",
  "#EF4444",
  "#F59E0B",
  "#06B6D4",
  "#A855F7",
  "#EC4899",
  "#10B981",
];
const pointStyles = ["circle", "triangle", "rectRounded", "rect", "cross", "star"] as const;
const averageColor = "#8B5CF6";

function toDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`toDateKey: invalid date value: ${value}`);
  }
  return toJstDateKey(date);
}

function toJstDateKey(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MINUTES * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function startOfJstDay(date: Date): Date {
  const jst = new Date(date.getTime() + JST_OFFSET_MINUTES * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
}

function buildDateKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  const end = startOfJstDay(now);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    keys.push(toJstDateKey(date));
  }
  return keys.slice(Math.max(0, keys.length - MAX_LABELS));
}

function formatLabel(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(parsed);
}

function getInitialSeriesValue<T>({
  items,
  firstKey,
  getDateKey,
  getValue,
}: {
  items: T[];
  firstKey: string;
  getDateKey: (item: T) => string;
  getValue: (item: T) => number | null | undefined;
}): number | null {
  let initial: number | null = null;
  for (const item of items) {
    const dateKey = getDateKey(item);
    if (dateKey > firstKey) break;
    const value = getValue(item);
    if (typeof value === "number") initial = value;
  }
  return initial;
}

export function RankingCreditTrendChart({
  users,
  histories,
  currentUserId,
  period,
  metric,
  metricValues,
  metricSeries,
  averageValue,
  averageSeries,
}: TrendChartProps) {
  const userIds = new Set(users.map((user) => user.id));
  const filtered = histories.filter((item) => userIds.has(item.user_id));
  const metricSeriesFiltered = (metricSeries ?? []).filter((item) => userIds.has(item.user_id));

  const baseKeys =
    period === "weekly"
      ? buildDateKeys(7)
      : period === "monthly"
        ? buildDateKeys(30)
        : buildDateKeys(TOTAL_RANGE_DAYS);
  const trimmedKeys = metric === "credits" ? baseKeys : baseKeys;
  const firstKey = trimmedKeys[0] ?? "";
  const labels = trimmedKeys.map((key) => formatLabel(key));

  const userSeries = users.map((user, index) => {
      const history = filtered
        .filter((item) => item.user_id === user.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const byDate = new Map<string, number>();
      for (const item of history) {
        byDate.set(toDateKey(item.created_at), item.total_credits);
      }
      let lastValue: number | null = getInitialSeriesValue({
        items: history,
        firstKey,
        getDateKey: (item) => toDateKey(item.created_at),
        getValue: (item) => item.total_credits,
      });
      const series =
        metric === "credits"
          ? trimmedKeys.map((key) => {
              const value = byDate.get(key);
              if (typeof value === "number") {
                lastValue = value;
                return value;
              }
              return lastValue;
            })
          : metric === "average_score"
            ? (() => {
                const scoreHistory = metricSeriesFiltered
                  .filter((point) => point.user_id === user.id)
                  .sort((a, b) => a.created_at.localeCompare(b.created_at));
                const scoreByDate = new Map<string, number>();
                for (const point of scoreHistory) {
                  scoreByDate.set(toDateKey(point.created_at), point.value);
                }
                let lastScore: number | null = getInitialSeriesValue({
                  items: scoreHistory,
                  firstKey,
                  getDateKey: (item) => toDateKey(item.created_at),
                  getValue: (item) => item.value,
                });
                return trimmedKeys.map((key) => {
                  const value = scoreByDate.get(key);
                  if (typeof value === "number") {
                    lastScore = value;
                    return value;
                  }
                  return lastScore;
                });
              })()
            : trimmedKeys.map(() => metricValues?.[user.id] ?? null);

      const isSelf = currentUserId && user.id === currentUserId;
      let label = `ユーザー${index + 1}`;
      if (index < 3) {
        label = `${index + 1}位`;
        if (isSelf) label = `${index + 1}位（自分）`;
      } else if (isSelf) {
        label = "自分";
      }
      const color = palette[index % palette.length];
      const pointStyle = pointStyles[Math.floor(index / palette.length) % pointStyles.length];
      return {
        label,
        data: series,
        borderColor: color,
        backgroundColor: color,
        borderWidth: isSelf ? 4 : 3,
        pointRadius: isSelf ? 3 : 2,
        pointStyle,
        pointHoverRadius: 4,
        tension: 0.3,
        spanGaps: true,
      };
    });

  const firstDataKey = (() => {
    if (metric !== "credits") return trimmedKeys[0];
    for (let i = 0; i < trimmedKeys.length; i += 1) {
      const hasValue = userSeries.some((dataset) => typeof dataset.data[i] === "number");
      if (hasValue) return trimmedKeys[i];
    }
    return trimmedKeys[0];
  })();

  const averageLabels = labels;
  let averageLine: Array<number | null> = [];
  if (averageSeries && averageSeries.length) {
    const seriesByDate = new Map<string, number>();
    for (const point of averageSeries) {
      seriesByDate.set(toDateKey(point.created_at), point.value);
    }
    const sortedAverageSeries = [...averageSeries].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    let lastValue: number | null = getInitialSeriesValue({
      items: sortedAverageSeries,
      firstKey: firstDataKey ?? firstKey,
      getDateKey: (item) => toDateKey(item.created_at),
      getValue: (item) => item.value,
    });
    averageLine = trimmedKeys.map((key) => {
      if (firstDataKey && key < firstDataKey) return null;
      const value = seriesByDate.get(key);
      if (typeof value === "number") {
        lastValue = value;
        return value;
      }
      return lastValue;
    });
  } else if (typeof averageValue === "number") {
    averageLine = averageLabels.map(() => averageValue);
  } else {
    averageLine = averageLabels.map((_, idx) => {
      const values = userSeries
        .map((dataset) => dataset.data[idx])
        .filter((value): value is number => typeof value === "number");
      if (!values.length) return null;
      const sum = values.reduce((acc, value) => acc + value, 0);
      return Math.round(sum / values.length);
    });
  }

  const data = {
    labels: averageLabels,
    datasets: [
      ...userSeries,
      {
        label: "平均",
        data: averageLine,
        borderColor: averageColor,
        backgroundColor: averageColor,
        borderWidth: 3,
        pointRadius: 0,
        pointStyle: "line",
        pointHoverRadius: 0,
        borderDash: [6, 4],
        tension: 0.2,
        spanGaps: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          usePointStyle: true,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8 },
      },
      y: {
        grid: { display: false },
        ticks: { precision: 0 },
      },
    },
  } as const;

  if (averageLabels.length === 0) {
    return <div className="text-sm text-muted-foreground">履歴データがありません。</div>;
  }

  return <Line data={data} options={options} />;
}
