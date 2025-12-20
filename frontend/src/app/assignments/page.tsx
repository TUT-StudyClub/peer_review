import AssignmentsClient from "./AssignmentsClient";

type AssignmentsPageProps = {
  searchParams?: { course_id?: string | string[] };
};

export default function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const courseIdParam = searchParams?.course_id;
  const initialCourseId = Array.isArray(courseIdParam)
    ? courseIdParam[0] ?? null
    : courseIdParam ?? null;

  return <AssignmentsClient initialCourseId={initialCourseId} />;
}
