import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const authHeader = _request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 講義詳細と課題一覧を並行取得
    const [courseResponse, assignmentsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/courses/${courseId}`, {
        headers: { Authorization: authHeader },
      }),
      fetch(`${API_BASE_URL}/assignments?course_id=${courseId}`),
    ]);

    if (!courseResponse.ok) {
      const errorText = await courseResponse.text();
      console.error("Course API error:", courseResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch course", detail: errorText },
        { status: courseResponse.status }
      );
    }

    const course = await courseResponse.json();
    const assignments = assignmentsResponse.ok ? await assignmentsResponse.json() : [];

    return NextResponse.json({
      course,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching course page data:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: String(error) },
      { status: 500 }
    );
  }
}
