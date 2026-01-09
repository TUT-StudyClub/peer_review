"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiEnrollCourse, apiGetReviewerSkill, apiListCourses, formatApiError } from "@/lib/api";
import type { CoursePublic, ReviewerSkill } from "@/lib/types";
import { REVIEWER_SKILL_AXES } from "@/lib/reviewerSkill";
import { RadarSkillChart } from "@/components/RadarSkillChart";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MyPageClient() {
  const { user, token, loading, refreshMe } = useAuth();

  const [skill, setSkill] = useState<ReviewerSkill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CoursePublic[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const enrolledCourses = useMemo(() => courses.filter((course) => course.is_enrolled), [courses]);
  const availableCourses = useMemo(() => courses.filter((course) => !course.is_enrolled), [courses]);

  const loadSkill = useCallback(async () => {
    if (!token) return;
    setSkillLoading(true);
    setSkillError(null);
    try {
      const data = await apiGetReviewerSkill(token);
      setSkill(data);
    } catch (err) {
      setSkillError(formatApiError(err));
    } finally {
      setSkillLoading(false);
    }
  }, [token]);

  const loadCourses = useCallback(async () => {
    if (!token) return;
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const list = await apiListCourses(token);
      setCourses(list);
    } catch (err) {
      setCoursesError(formatApiError(err));
    } finally {
      setCoursesLoading(false);
    }
  }, [token]);

  const enrollCourse = useCallback(
    async (courseId: string) => {
      if (!token) return;
      setEnrollingCourseId(courseId);
      setCoursesError(null);
      try {
        await apiEnrollCourse(token, courseId);
        setCourses((prev) =>
          prev.map((course) =>
            course.id === courseId ? { ...course, is_enrolled: true } : course
          )
        );
      } catch (err) {
        setCoursesError(formatApiError(err));
      } finally {
        setEnrollingCourseId(null);
      }
    },
    [token]
  );



  const refreshAll = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await Promise.all([refreshMe(), loadSkill(), loadCourses()]);
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshMe, loadSkill, loadCourses]);

  useEffect(() => {
    if (!token || user?.role !== "student") return;
    void loadSkill();
    void loadCourses();
  }, [loadSkill, loadCourses, token, user?.role]);



  const formatSkill = (value: number) => (value > 0 ? value.toFixed(2) : "-");

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>学生マイページ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">ログインするとマイページを利用できます。</p>
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

  if (user.role !== "student") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>学生マイページ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">このページは学生専用です。</p>
          <Button asChild variant="outline">
            <Link href="/assignments">課題一覧へ</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">学生マイページ</h1>
          <p className="text-sm text-muted-foreground">学習状況とレビュアースキルの確認</p>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()} disabled={!token || refreshing}>
          {refreshing ? "更新中..." : "まとめて更新"}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>プロフィール</CardTitle>
          <div className="text-xs text-muted-foreground">joined: {new Date(user.created_at).toLocaleString()}</div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">名前</div>
              <div className="text-sm font-medium">{user.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">メール</div>
              <div className="text-sm">{user.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ランク / タイトル</div>
              <div className="text-sm">
                {user.rank} / {user.title}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">credits / TA</div>
              <div className="text-sm">
                {user.credits} / {user.is_ta ? "TA" : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>レビュアースキル（総合 / teacher比較）</CardTitle>
          <Button variant="outline" onClick={loadSkill} disabled={!token || skillLoading}>
            {skillLoading ? "読み込み中..." : "更新"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {skillError ? (
            <Alert variant="destructive">
              <AlertTitle>取得に失敗しました</AlertTitle>
              <AlertDescription>{skillError}</AlertDescription>
            </Alert>
          ) : null}
          {!token ? (
            <p className="text-sm text-muted-foreground">ログインすると確認できます</p>
          ) : skillLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : skill ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                {REVIEWER_SKILL_AXES.map((axis) => (
                  <div key={axis.key}>
                    {axis.label}: {formatSkill(skill[axis.key])}
                  </div>
                ))}
                <div>総合: {formatSkill(skill.overall)}</div>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <RadarSkillChart skill={skill} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「更新」を押して取得してください</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>受講中の授業</CardTitle>
          <Button variant="outline" onClick={loadCourses} disabled={!token || coursesLoading}>
            {coursesLoading ? "読み込み中..." : "更新"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {coursesError ? (
            <Alert variant="destructive">
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>
                <ErrorMessages message={coursesError} />
              </AlertDescription>
            </Alert>
          ) : null}
          {coursesLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {!coursesLoading && enrolledCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">受講中の授業がありません。</p>
          ) : null}
          <ul className="space-y-2">
            {enrolledCourses.map((course) => {
              return (
                <li key={course.id}>
                  <div className="rounded-lg border border-border p-4 transition hover:bg-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{course.title}</div>
                        {course.description ? (
                          <div className="mt-1 text-sm text-muted-foreground">{course.description}</div>
                        ) : null}
                        {course.teacher_name ? (
                          <div className="mt-2 text-xs text-muted-foreground">teacher: {course.teacher_name}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button asChild className="w-full bg-slate-600 hover:bg-slate-700">
                        <Link href={`/courses/${course.id}`}>授業ページへ</Link>
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>授業一覧（受講登録）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {coursesLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
          {!coursesLoading && availableCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">受講可能な授業がありません。</p>
          ) : null}
          <ul className="space-y-2">
            {availableCourses.map((course) => (
              <li key={course.id}>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{course.title}</div>
                      {course.description ? (
                        <div className="mt-1 text-sm text-muted-foreground">{course.description}</div>
                      ) : null}
                      {course.teacher_name ? (
                        <div className="mt-2 text-xs text-muted-foreground">teacher: {course.teacher_name}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => enrollCourse(course.id)}
                        disabled={enrollingCourseId === course.id}
                      >
                        {enrollingCourseId === course.id ? "登録中..." : "受講する"}
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
