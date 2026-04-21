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

    // ── DIAGNOSTIC — remove once lessons are confirmed working ──────────
    console.log("[upcoming_GET] user.id =", user.id, "type =", typeof user.id);
    // ────────────────────────────────────────────────────────────────────

    const ceResult = await supabaseAdmin
      .from("courseEnrollments")
      .select("id,courseId,status,userId")
      .eq("userId", user.id as any)
      .in("status", ["active", "completed"]);
    let enrollments: any[] = ceResult.data ?? [];
    const enrollmentErr = ceResult.error;

    // ── DIAGNOSTIC ───────────────────────────────────────────────────────
    console.log("[upcoming_GET] enrollment query result:", { count: enrollments.length, enrollmentErr });
    // ────────────────────────────────────────────────────────────────────

    if (enrollmentErr || enrollments.length === 0) {
      const snake = await supabaseAdmin
        .from("course_enrollments")
        .select("id,course_id,status,user_id")
        .eq("user_id", user.id as any)
        .in("status", ["active", "completed"]);
      if (snake.error && !isSchemaError(snake.error)) throw snake.error;
      if (!snake.error && snake.data && snake.data.length > 0) {
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

    // ── DIAGNOSTIC ───────────────────────────────────────────────────────
    console.log("[upcoming_GET] final enrollmentRows:", enrollmentRows);
    // ────────────────────────────────────────────────────────────────────

    if (enrollmentRows.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    const enrollmentIds = enrollmentRows.map((e: any) => e.id);
    const enrollmentMap = new Map(
      enrollmentRows.map((e: any) => [String(e.id), e])
    );

    const schedResult = await supabaseAdmin
      .from("lessonSchedules")
      .select("id,enrollmentId,lessonNumber,scheduledAt")
      .in("enrollmentId", enrollmentIds)
      .gte("scheduledAt", nowIso)
      .order("scheduledAt", { ascending: true });
    let schedules: any[] = schedResult.data ?? [];
    const scheduleErr = schedResult.error;

    // ── DIAGNOSTIC ───────────────────────────────────────────────────────
    console.log("[upcoming_GET] schedule query result:", { count: schedules.length, scheduleErr, enrollmentIds });
    // ────────────────────────────────────────────────────────────────────

    if (scheduleErr || schedules.length === 0) {
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

    // Fetch upcoming contests in parallel with course lookup
    const allEnrollmentCourseIds = Array.from(
      new Set(enrollmentRows.map((e: any) => e.courseId).filter(Boolean))
    );

    const [coursesResult, contestResult] = await Promise.all([
      allEnrollmentCourseIds.length > 0
        ? supabaseAdmin.from("courses").select("id,name").in("id", allEnrollmentCourseIds as any)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from("contestSchedules")
        .select("id,enrollmentId,moduleNumber,scheduledAt")
        .in("enrollmentId", enrollmentIds as any[])
        .gte("scheduledAt", nowIso)
        .order("scheduledAt", { ascending: true }),
    ]);

    if (coursesResult.error && !isSchemaError(coursesResult.error)) throw coursesResult.error;
    const courseMap = new Map((coursesResult.data ?? []).map((c: any) => [String(c.id), c.name]));

    const lessonSessions = scheduleRows.map((s: any) => {
      const enrollment = enrollmentMap.get(String(s.enrollmentId));
      const courseId = enrollment?.courseId ?? null;
      return {
        id: s.id,
        enrollmentId: s.enrollmentId,
        courseId,
        courseName: courseId ? courseMap.get(String(courseId)) ?? "Course" : "Course",
        type: "lesson" as const,
        lessonNumber: s.lessonNumber as number,
        moduleNumber: undefined as number | undefined,
        scheduledAt: s.scheduledAt,
      };
    });

    const contestSessions = (contestResult.data ?? []).map((c: any) => {
      const enrollment = enrollmentMap.get(String(c.enrollmentId));
      const courseId = enrollment?.courseId ?? null;
      return {
        id: c.id,
        enrollmentId: c.enrollmentId,
        courseId,
        courseName: courseId ? courseMap.get(String(courseId)) ?? "Course" : "Course",
        type: "contest" as const,
        lessonNumber: undefined as number | undefined,
        moduleNumber: c.moduleNumber as number,
        scheduledAt: c.scheduledAt,
      };
    });

    const lessons = [...lessonSessions, ...contestSessions].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

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
