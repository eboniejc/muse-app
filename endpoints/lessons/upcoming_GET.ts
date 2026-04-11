import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import superjson from "superjson";
import { OutputType } from "./upcoming_GET.schema";

function isSchemaError(error: any): boolean {
  const message = String(error?.message ?? "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    // Show lessons from start of today (not just strict future) so lessons
    // scheduled earlier today still appear in the student's view.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const fromIso = todayStart.toISOString();

    let enrollments: any[] = [];

    // 1. Try camelCase columns
    const { data: ceData, error: ceErr } = await supabaseAdmin
      .from("courseEnrollments")
      .select("id,courseId,status,userId")
      .eq("userId", user.id as any)
      .in("status", ["active", "completed"]);

    if (!ceErr && ceData && ceData.length > 0) {
      enrollments = ceData;
    } else {
      // 2. Same table, snake_case columns (most common Supabase default)
      const { data: snakeData, error: snakeErr } = await supabaseAdmin
        .from("courseEnrollments")
        .select("id,course_id,status,user_id")
        .eq("user_id", user.id as any)
        .in("status", ["active", "completed"]);

      if (!snakeErr && snakeData && snakeData.length > 0) {
        enrollments = snakeData.map((e: any) => ({
          id: e.id,
          courseId: e.course_id ?? e.courseId,
          status: e.status,
          userId: e.user_id ?? e.userId,
        }));
      } else if (snakeErr && !isSchemaError(snakeErr)) {
        throw snakeErr;
      } else if (ceErr && !isSchemaError(ceErr)) {
        throw ceErr;
      }
    }

    const enrollmentRows = enrollments ?? [];
    if (enrollmentRows.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    const enrollmentIds = enrollmentRows.map((e: any) => e.id);
    const enrollmentMap = new Map(
      enrollmentRows.map((e: any) => [String(e.id), e])
    );

    let schedules: any[] = [];

    // Try camelCase column names first (matches the import write path)
    const { data: schedData, error: schedErr } = await supabaseAdmin
      .from("lessonSchedules")
      .select("id,enrollmentId,lessonNumber,scheduledAt")
      .in("enrollmentId", enrollmentIds)
      .gte("scheduledAt", fromIso)
      .order("scheduledAt", { ascending: true });

    if (!schedErr && schedData && schedData.length > 0) {
      schedules = schedData;
    } else {
      // Fallback: try snake_case column names
      const { data: snakeData, error: snakeErr } = await supabaseAdmin
        .from("lessonSchedules")
        .select("id,enrollment_id,lesson_number,scheduled_at")
        .in("enrollment_id", enrollmentIds)
        .gte("scheduled_at", fromIso)
        .order("scheduled_at", { ascending: true });

      if (!snakeErr && snakeData && snakeData.length > 0) {
        schedules = snakeData.map((s: any) => ({
          id: s.id,
          enrollmentId: s.enrollment_id,
          lessonNumber: s.lesson_number,
          scheduledAt: s.scheduled_at,
        }));
      } else if (snakeErr && !isSchemaError(snakeErr)) {
        throw snakeErr;
      } else if (schedErr && !isSchemaError(schedErr)) {
        throw schedErr;
      }
    }

    const scheduleRows = schedules ?? [];
    if (scheduleRows.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    const courseIds = Array.from(
      new Set(
        scheduleRows
          .map((s: any) => enrollmentMap.get(String(s.enrollmentId))?.courseId)
          .filter(Boolean)
      )
    );

    let courses: any[] = [];
    if (courseIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("courses")
        .select("id,name")
        .in("id", courseIds as any);
      if (error && !isSchemaError(error)) throw error;
      courses = data ?? [];
    }
    const courseMap = new Map(courses.map((c: any) => [String(c.id), c.name]));

    const lessons = scheduleRows.map((s: any) => {
      const enrollment = enrollmentMap.get(String(s.enrollmentId));
      const courseId = enrollment?.courseId ?? null;
      return {
        id: s.id,
        enrollmentId: s.enrollmentId,
        courseId,
        courseName: courseId ? courseMap.get(String(courseId)) ?? "Course" : "Course",
        lessonNumber: s.lessonNumber,
        scheduledAt: s.scheduledAt,
      };
    });

    return new Response(
      superjson.stringify({ lessons } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error fetching upcoming lessons:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch upcoming lessons" }),
      { status: 500 }
    );
  }
}

