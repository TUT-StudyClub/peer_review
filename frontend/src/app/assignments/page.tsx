import AssignmentsClient from "./AssignmentsClient";

type AssignmentsPageProps = {
  searchParams?: Promise<{ course_id?: string | string[] }> | { course_id?: string | string[] };
};

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const courseIdParam = resolvedSearchParams?.course_id;
  const initialCourseId = Array.isArray(courseIdParam)
    ? courseIdParam[0] ?? null
    : courseIdParam ?? null;

  return <AssignmentsClient initialCourseId={initialCourseId} />;
}
