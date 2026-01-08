import AssignmentsClient from "./AssignmentsClient";

type AssignmentsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const getFirstParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export default function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const initialCourseId = getFirstParam(searchParams?.course_id);
  const viewParam = getFirstParam(searchParams?.view);
  const initialCourseView = viewParam === "create" ? "create" : "list";

  return <AssignmentsClient initialCourseId={initialCourseId} initialCourseView={initialCourseView} />;
}
