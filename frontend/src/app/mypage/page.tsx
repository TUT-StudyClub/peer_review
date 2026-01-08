import MyPageClient from "./MyPageClient";

type MyPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const getFirstParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export default function MyPagePage({ searchParams }: MyPageProps) {
  const initialCourseId = getFirstParam(searchParams?.course_id);

  return <MyPageClient initialCourseId={initialCourseId} />;
}
