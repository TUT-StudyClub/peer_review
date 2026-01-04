"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGetCoursePage, formatApiError } from "@/lib/api";
import type { AssignmentPublic, CoursePublic } from "@/lib/types";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CourseLecturePage() {
  const { token, loading } = useAuth();
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId as string;

  const [course, setCourse] = useState<CoursePublic | null>(null);
  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadCoursePage = useCallback(async () => {
    if (!token || !courseId) return;
    setPageLoading(true);
    setPageError(null);
    try {
      const data = await apiGetCoursePage(token, courseId);
      setCourse(data.course);
      setAssignments(data.assignments);
    } catch (err) {
      setPageError(formatApiError(err));
    } finally {
      setPageLoading(false);
    }
  }, [token, courseId]);

  useEffect(() => {
    if (loading) return;
    void loadCoursePage();
  }, [loading, loadCoursePage]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>講義ページ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">ログインするとページを利用できます。</p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/auth/login">ログイン</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/auth/register">新規登録</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">講義ページ</h1>
          <p className="text-sm text-muted-foreground">受講中の授業情報を確認します</p>
        </div>
        <Button variant="outline" onClick={() => void loadCoursePage()} disabled={pageLoading}>
          {pageLoading ? "更新中..." : "更新"}
        </Button>
      </div>

      {pageError ? (
        <Alert variant="destructive">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>
            <ErrorMessages message={pageError} />
          </AlertDescription>
        </Alert>
      ) : null}

      {pageLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : !course ? (
        <Alert>
          <AlertTitle>見つかりません</AlertTitle>
          <AlertDescription>この講義は見つかりませんでした。</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{course.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {course.description ? (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">概要</h3>
                  <p className="mt-2">{course.description}</p>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-accent p-3">
                  <div className="text-xs text-muted-foreground">講師</div>
                  <div className="mt-1 font-medium">{course.teacher_name || "未設定"}</div>
                </div>
                <div className="rounded-lg border border-border bg-accent p-3">
                  <div className="text-xs text-muted-foreground">受講開始日</div>
                  <div className="mt-1 font-medium text-sm">
                    {new Date(course.created_at).toLocaleDateString("ja-JP")}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-accent p-3">
                  <div className="text-xs text-muted-foreground">登録状況</div>
                  <div className="mt-1 font-medium">
                    {course.is_enrolled ? (
                      <span className="text-green-700">登録済み</span>
                    ) : (
                      <span className="text-muted-foreground">未登録</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {course.is_enrolled ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardTitle>課題一覧</CardTitle>
                <Button variant="outline" onClick={() => void loadCoursePage()} disabled={pageLoading}>
                  {pageLoading ? "読み込み中..." : "更新"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {pageLoading ? (
                  <p className="text-sm text-muted-foreground">読み込み中...</p>
                ) : assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">この授業にはまだ課題がありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map((assignment) => (
                      <li key={assignment.id}>
                        <Link href={`/assignments/${assignment.id}`} className="block">
                          <div className="rounded-lg border border-border p-4 transition hover:bg-accent">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{assignment.title}</div>
                                {assignment.description ? (
                                  <div className="mt-1 text-sm text-muted-foreground">
                                    {assignment.description}
                                  </div>
                                ) : null}
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <div>reviews/submission: {assignment.target_reviews_per_submission}</div>
                                <div>{new Date(assignment.created_at).toLocaleString()}</div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
