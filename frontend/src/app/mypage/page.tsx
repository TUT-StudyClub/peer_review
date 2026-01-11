import MyPageClient from "./MyPageClient";

type MyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getFirstParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export default async function MyPagePage({ searchParams }: MyPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialCourseId = getFirstParam(resolvedSearchParams?.course_id);

  return <MyPageClient initialCourseId={initialCourseId} />;
}
