"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiListCourses, formatApiError } from "@/lib/api";
import type { CoursePublic } from "@/lib/types";
import { ErrorMessages } from "@/components/ErrorMessages";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function CoursePage() {
  const params = useParams();
  const courseIdParam = params?.courseId;
  const courseId = Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam;
  const { token } = useAuth();
  const [course, setCourse] = useState<CoursePublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourse = useCallback(async () => {
    if (!token || !courseId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiListCourses(token);
      const found = list.find((item) => item.id === courseId) ?? null;
      if (!found) {
        setCourse(null);
        setError("授業が見つかりませんでした。");
        return;
      }
      setCourse(found);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{course?.title ?? "授業"}</h1>
        {course?.description ? (
          <p className="text-sm text-muted-foreground">{course.description}</p>
        ) : null}
        {course?.teacher_name ? (
          <p className="text-xs text-muted-foreground">teacher: {course.teacher_name}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/assignments?course_id=${courseId}`}>課題一覧へ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/assignments">授業一覧へ戻る</Link>
        </Button>
      </div>

      {!token ? (
        <p className="text-sm text-muted-foreground">ログインすると授業の詳細を確認できます。</p>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>
            <ErrorMessages message={error} />
          </AlertDescription>
        </Alert>
      ) : null}

      {token && loading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
    </div>
  );
}
