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
    const nowIso = new Date().toISOString();

    let enrollments: any[] = [];
    let enrollmentErr: any = null;
    ({ data: enrollments, error: enrollmentErr } = await supabaseAdmin
      .from("courseEnrollments")
      .select("id,courseId,status,userId")
      .eq("userId", user.id as any)
      .in("status", ["active", "completed"]));

    if (enrollmentErr || !enrollments) {
      const snake = await supabaseAdmin
        .from("course_enrollments")
        .select("id,course_id,status,user_id")
        .eq("user_id", user.id as any)
        .in("status", ["active", "completed"]);
      if (snake.error && !isSchemaError(snake.error)) throw snake.error;
      if (!snake.error && snake.data) {
        enrollments = snake.data.map((e: any) => ({
          id: e.id,
          courseId: e.course_id,
          status: e.status,
          userId: e.user_id,
        }));
      } else if (enrollmentErr && !isSchemaError(enrollmentErr)) {
        throw enrollmentErr;
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
    let scheduleErr: any = null;
    ({ data: schedules, error: scheduleErr } = await supabaseAdmin
      .from("lessonSchedules")
      .select("id,enrollmentId,lessonNumber,scheduledAt")
      .in("enrollmentId", enrollmentIds)
      .gte("scheduledAt", nowIso)
      .order("scheduledAt", { ascending: true }));

    if (scheduleErr || !schedules) {
      const snake = await supabaseAdmin
        .from("lesson_schedules")
        .select("id,enrollment_id,lesson_number,scheduled_at")
        .in("enrollment_id", enrollmentIds)
        .gte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true });
      if (snake.error && !isSchemaError(snake.error)) throw snake.error;
      if (!snake.error && snake.data) {
        schedules = snake.data.map((s: any) => ({
          id: s.id,
          enrollmentId: s.enrollment_id,
          lessonNumber: s.lesson_number,
          scheduledAt: s.scheduled_at,
        }));
      } else if (scheduleErr && !isSchemaError(scheduleErr)) {
        throw scheduleErr;
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

