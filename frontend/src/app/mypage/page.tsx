"use client";

import { useSearchParams } from "next/navigation";

import MyPageClient from "./MyPageClient";

export default function MyPagePage() {
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("course_id");
  const initialCourseId = courseIdParam ?? null;

  return <MyPageClient initialCourseId={initialCourseId} />;
}
