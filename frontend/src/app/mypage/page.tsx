import MyPageClient from "./MyPageClient";

type MyPagePageProps = {
  searchParams?: Promise<{ course_id?: string | string[] }> | { course_id?: string | string[] };
};

export default async function MyPagePage({ searchParams }: MyPagePageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const courseIdParam = resolvedSearchParams?.course_id;
  const initialCourseId = Array.isArray(courseIdParam)
    ? courseIdParam[0] ?? null
    : courseIdParam ?? null;

  return <MyPageClient initialCourseId={initialCourseId} />;
}
