"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AssignmentPublic, CoursePublic } from "@/lib/types";

type DeadlineTimelineProps = {
    assignments: AssignmentPublic[];
    courses: CoursePublic[];
    enrolledOnly?: boolean;
};

export function DeadlineTimeline({ assignments, courses, enrolledOnly = true }: DeadlineTimelineProps) {
    const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
    const enrolledIds = useMemo(() => new Set(courses.filter(c => !enrolledOnly || c.is_enrolled).map(c => c.id)), [courses, enrolledOnly]);
    const [now] = useState(() => Date.now());

    const timelineItems = useMemo(() => {
        const dayMs = 1000 * 60 * 60 * 24;

        const items = assignments.flatMap((assignment) => {
            if (!assignment.course_id || !enrolledIds.has(assignment.course_id) || !assignment.due_at) {
                return [];
            }
            const dueAt = new Date(assignment.due_at);
            const createdAt = new Date(assignment.created_at);
            if (Number.isNaN(dueAt.getTime())) return [];
            if (Number.isNaN(createdAt.getTime())) return [];

            const diffMs = dueAt.getTime() - now;
            const daysLeft = Math.ceil(diffMs / dayMs);
            let statusLabel = "";
            let tone: "overdue" | "soon" | "normal" = "normal";

            if (diffMs < 0) {
                statusLabel = "期限切れ";
                tone = "overdue";
            } else if (diffMs <= dayMs * 3) {
                statusLabel = diffMs <= dayMs ? "24時間以内" : `あと${daysLeft}日`;
                tone = "soon";
            } else {
                statusLabel = `あと${daysLeft}日`;
            }

            const startMs = Math.min(createdAt.getTime(), dueAt.getTime());
            const endMs = Math.max(createdAt.getTime(), dueAt.getTime());

            return [
                {
                    id: assignment.id,
                    title: assignment.title,
                    courseTitle: courseById.get(assignment.course_id)?.title ?? "授業未設定",
                    createdAt,
                    dueAt,
                    startAt: new Date(startMs),
                    endAt: new Date(endMs),
                    statusLabel,
                    tone,
                },
            ];
        });

        return items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    }, [assignments, courseById, enrolledIds, now]);

    const timelineRange = useMemo(() => {
        if (!timelineItems.length) return null;
        const startMs = Math.min(...timelineItems.map((item) => item.startAt.getTime()));
        const endMs = Math.max(...timelineItems.map((item) => item.endAt.getTime()), now);
        const rangeMs = Math.max(endMs - startMs, 1000 * 60 * 60 * 24);
        return { startMs, endMs, rangeMs };
    }, [timelineItems, now]);

    const timelineTicks = useMemo(() => {
        if (!timelineRange) return [];
        const steps = 4;
        return Array.from({ length: steps + 1 }, (_, index) => {
            const ratio = index / steps;
            const tickDate = new Date(timelineRange.startMs + timelineRange.rangeMs * ratio);
            return {
                label: tickDate.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" }),
                percent: ratio * 100,
            };
        });
    }, [timelineRange]);

    const todayPercent = useMemo(() => {
        if (!timelineRange) return null;
        const percent = ((now - timelineRange.startMs) / timelineRange.rangeMs) * 100;
        return Math.min(100, Math.max(0, percent));
    }, [timelineRange, now]);

    if (timelineItems.length === 0) {
        return <p className="text-sm text-muted-foreground">提出期限が設定された課題がありません。</p>;
    }

    return (
        <div className="space-y-4">
            {timelineRange ? (
                <div className="hidden sm:block">
                    <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] items-center gap-3 text-xs text-muted-foreground">
                        <div />
                        <div className="relative h-6">
                            {timelineTicks.map((tick) => (
                                <span
                                    key={tick.percent}
                                    className="absolute -translate-x-1/2 text-[11px]"
                                    style={{ left: `${tick.percent}%` }}
                                >
                                    {tick.label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-3">
                        <div />
                        <div className="relative h-2 rounded-full bg-slate-100">
                            {timelineTicks.map((tick) => (
                                <span
                                    key={`tick-${tick.percent}`}
                                    className="absolute -top-1 h-4 w-px bg-slate-200"
                                    style={{ left: `${tick.percent}%` }}
                                    aria-hidden
                                />
                            ))}
                            {todayPercent !== null ? (
                                <span
                                    className="absolute -top-1 h-4 w-px bg-sky-400/50"
                                    style={{ left: `${todayPercent}%` }}
                                    aria-hidden
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
            <ol className="space-y-3">
                {timelineItems.map((item) => {
                    const badgeClassName =
                        item.tone === "overdue"
                            ? "bg-rose-100 text-rose-700"
                            : item.tone === "soon"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700";
                    const barClassName =
                        item.tone === "overdue"
                            ? "bg-rose-500"
                            : item.tone === "soon"
                                ? "bg-amber-500"
                                : "bg-emerald-500";
                    const range = timelineRange;
                    const startPercent = range
                        ? Math.min(
                            100,
                            Math.max(0, ((item.startAt.getTime() - range.startMs) / range.rangeMs) * 100)
                        )
                        : 0;
                    const endPercent = range
                        ? Math.min(
                            100,
                            Math.max(0, ((item.endAt.getTime() - range.startMs) / range.rangeMs) * 100)
                        )
                        : 0;
                    const minWidth = 2;
                    const rawWidth = endPercent - startPercent;
                    const widthPercent = Math.min(Math.max(rawWidth, minWidth), 100 - startPercent);

                    return (
                        <li key={item.id} className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center">
                            <div className="space-y-1">
                                <Link
                                    href={`/assignments/${item.id}`}
                                    className="text-sm font-medium text-slate-900 hover:underline"
                                >
                                    {item.title}
                                </Link>
                                <div className="text-xs text-slate-500">{item.courseTitle}</div>
                                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                                    <span>作成: {item.createdAt.toLocaleDateString()}</span>
                                    <span>提出期限: {item.dueAt.toLocaleString()}</span>
                                </div>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${badgeClassName}`}>
                                    {item.statusLabel}
                                </span>
                            </div>
                            <div className="relative h-10 rounded-full bg-slate-100">
                                {todayPercent !== null ? (
                                    <span
                                        className="absolute inset-y-0 w-px bg-sky-400/40"
                                        style={{ left: `${todayPercent}%` }}
                                        aria-hidden
                                    />
                                ) : null}
                                <span
                                    className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${barClassName}`}
                                    style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                                    aria-hidden
                                />
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
