import AssignmentsClient from "./AssignmentsClient";

type AssignmentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getFirstParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialCourseId = getFirstParam(resolvedSearchParams?.course_id);
  const viewParam = getFirstParam(resolvedSearchParams?.view);
  const initialCourseView = viewParam === "create" ? "create" : "list";

  return <AssignmentsClient initialCourseId={initialCourseId} initialCourseView={initialCourseView} />;
}
