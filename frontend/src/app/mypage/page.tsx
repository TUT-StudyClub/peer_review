"use client";

import { useAuth } from "@/app/providers";
import { useCallback, useEffect, useState } from "react";
import { apiGetReviewerSkill } from "@/lib/api";
import { ReviewerSkill } from "@/lib/types";
import { RadarSkillChart } from "@/components/RadarSkillChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REVIEWER_SKILL_AXES = [
    { key: "logic", label: "論理性（Logic）" },
    { key: "specificity", label: "具体性（Specificity）" },
    { key: "empathy", label: "共感性（Empathy）" },
    { key: "insight", label: "洞察性（Insight）" },
];

export default function MyPage() {
    const { user, token } = useAuth();
    const [skill, setSkill] = useState<ReviewerSkill | null>(null);
    const [skillLoading, setSkillLoading] = useState(false);
    const [skillError, setSkillError] = useState<string | null>(null);

    const formatSkill = (value: number) => (value > 0 ? value.toFixed(2) : "-");

    const loadOverallSkill = useCallback(async () => {
        if (!token) return;
        setSkillLoading(true);
        setSkillError(null);
        try {
            const skillData = await apiGetReviewerSkill(token);
            setSkill(skillData);
        } catch (err) {
            setSkillError(err instanceof Error ? err.message : "スキル取得に失敗しました");
        } finally {
            setSkillLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (user?.role === "student" && token) {
            void loadOverallSkill();
        }
    }, [loadOverallSkill, user?.role, token]);

    if (!user) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">マイページ</h1>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground">マイページを表示するにはログインしてください</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">マイページ</h1>

            {/* アカウント情報カード */}
            <Card>
                <CardHeader>
                    <CardTitle>アカウント情報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="text-sm text-muted-foreground">名前</p>
                            <p className="text-lg font-semibold">{user.name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">メールアドレス</p>
                            <p className="text-lg font-semibold">{user.email}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">ロール</p>
                            <p className="text-lg font-semibold">
                                {user.role === "student" ? "学生" : "教員"}
                            </p>
                        </div>
                        {user.is_ta && (
                            <div>
                                <p className="text-sm text-muted-foreground">TA</p>
                                <p className="text-lg font-semibold">⭐ TA に認定</p>
                            </div>
                        )}
                    </div>

                    {/* スチューデント用の情報 */}
                    {user.role === "student" && (
                        <div className="border-t pt-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <p className="text-sm text-muted-foreground">ランク</p>
                                    <p className="text-lg font-semibold">{user.rank}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">クレジット</p>
                                    <p className="text-lg font-semibold">{user.credits}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">称号</p>
                                    <p className="rounded-full bg-muted px-2 py-0.5 text-sm font-medium">
                                        {user.title}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* レビュアースキル */}
            {user.role === "student" && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>レビュアースキル（総合）</CardTitle>
                            <Button
                                variant="outline"
                                onClick={loadOverallSkill}
                                disabled={!token || skillLoading}
                            >
                                {skillLoading ? "更新中..." : "更新"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {skillError && (
                            <p className="text-sm text-red-500 mb-4">{skillError}</p>
                        )}
                        {!skill ? (
                            <p className="text-sm text-muted-foreground">
                                スキル情報はまだ取得できません
                            </p>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <div className="font-semibold">各軸のスコア</div>
                                    {REVIEWER_SKILL_AXES.map((axis) => (
                                        <div key={axis.key} className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">
                                                {axis.label}
                                            </span>
                                            <span className="font-semibold">
                                                {formatSkill(skill[axis.key as keyof ReviewerSkill])}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="border-t pt-2 flex items-center justify-between font-semibold">
                                        <span>総合</span>
                                        <span className="text-lg">{formatSkill(skill.overall)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center rounded-lg border bg-background p-4">
                                    <div className="w-full">
                                        <RadarSkillChart skill={skill} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
