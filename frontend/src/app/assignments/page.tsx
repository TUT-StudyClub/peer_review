"use client";

import { useSearchParams } from "next/navigation";

import AssignmentsClient from "./AssignmentsClient";

export default function AssignmentsPage() {
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("course_id");
  const initialCourseId = courseIdParam ?? null;

  return <AssignmentsClient initialCourseId={initialCourseId} />;
}
