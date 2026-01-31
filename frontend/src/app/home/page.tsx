'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/providers';
import { apiListAssignments, apiListCourses, formatApiError } from '@/lib/api';
import type { AssignmentPublic, CoursePublic } from '@/lib/types';
import { DeadlineTimeline } from '@/components/DeadlineTimeline';
import { RecentNotifications } from '@/components/RecentNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessages } from '@/components/ErrorMessages';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
    const { token, user, loading } = useAuth();
    const [courses, setCourses] = useState<CoursePublic[]>([]);
    const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const [courseList, assignmentList] = await Promise.all([
                apiListCourses(token),
                apiListAssignments()
            ]);
            setCourses(courseList);
            setAssignments(assignmentList);
        } catch (err) {
            setError(formatApiError(err));
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token, fetchData]);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <p className="text-sm text-muted-foreground">読み込み中...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pure Review へようこそ</h1>
                    <p className="max-w-[500px] text-slate-500">
                        相互レビューを通じて、より深く学び、より質の高い課題を提出しましょう。
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button asChild size="lg">
                        <Link href="/auth/login">ログイン</Link>
                    </Button>
                    <Button variant="outline" asChild size="lg">
                        <Link href="/auth/register">新規登録</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">ホーム</h1>
                <p className="text-muted-foreground mt-1">
                    {user.name}さん、お疲れ様です。現在のステータスを確認しましょう。
                </p>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>エラーが発生しました</AlertTitle>
                    <AlertDescription>
                        <ErrorMessages message={error} />
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
                {/* メインカラム: タイムライン */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">提出期限タイムライン</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => fetchData()} disabled={isLoading}>
                                {isLoading ? "更新中..." : "更新"}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DeadlineTimeline
                                assignments={assignments}
                                courses={courses}
                                enrolledOnly={user.role === 'student'}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* サイドカラム: 通知など */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">通知</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RecentNotifications />
                        </CardContent>
                    </Card>

                    {/* クイックリンク */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">クイックリンク</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            <Button variant="outline" asChild className="justify-start text-xs h-9">
                                <Link href="/assignments">課題一覧</Link>
                            </Button>
                            <Button variant="outline" asChild className="justify-start text-xs h-9">
                                <Link href="/mypage">マイページ</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
