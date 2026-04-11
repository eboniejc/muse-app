import { db } from "../../helpers/db";
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
    error?.code === "42703" ||
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

    // Step 1: Get the student's enrollments via Kysely (CamelCasePlugin handles
    // camelCase→snake_case translation automatically), falling back to Supabase REST.
    let enrollmentRows: { id: number; courseId: number; status: string }[] = [];

    try {
      const rows = await db
        .selectFrom("courseEnrollments")
        .select(["courseEnrollments.id", "courseEnrollments.courseId", "courseEnrollments.status"])
        .where("courseEnrollments.userId", "=", user.id as any)
        .where("courseEnrollments.status", "in", ["active", "completed"])
        .execute();
      enrollmentRows = rows as any;
    } catch (kyselyErr) {
      if (!isSchemaError(kyselyErr)) throw kyselyErr;
      // Kysely failed — try Supabase REST with camelCase table name
      const { data: ceData, error: ceErr } = await supabaseAdmin
        .from("courseEnrollments")
        .select("id,courseId,status")
        .eq("userId", user.id as any)
        .in("status", ["active", "completed"]);

      if (!ceErr && ceData && ceData.length > 0) {
        enrollmentRows = ceData.map((e: any) => ({
          id: e.id,
          courseId: e.courseId ?? e.course_id,
          status: e.status,
        }));
      } else {
        // Try snake_case fallback
        const { data: snakeData } = await supabaseAdmin
          .from("course_enrollments")
          .select("id,course_id,status")
          .eq("user_id", user.id as any)
          .in("status", ["active", "completed"]);
        if (snakeData && snakeData.length > 0) {
          enrollmentRows = snakeData.map((e: any) => ({
            id: e.id,
            courseId: e.course_id,
            status: e.status,
          }));
        }
      }
    }

    if (enrollmentRows.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    const enrollmentIds = enrollmentRows.map((e) => e.id);
    const enrollmentMap = new Map(enrollmentRows.map((e) => [e.id, e]));

    // Step 2: Fetch upcoming lesson schedules via Supabase (avoids Kysely
    // CamelCase translation issue where lessonSchedules → lesson_schedules).
    const { data: rawSchedules, error: schedErr } = await supabaseAdmin
      .from("lessonSchedules")
      .select("id,enrollmentId,lessonNumber,scheduledAt")
      .in("enrollmentId", enrollmentIds as any[])
      .gte("scheduledAt", fromIso)
      .order("scheduledAt", { ascending: true });

    if (schedErr && !isSchemaError(schedErr)) throw schedErr;

    const scheduleRows = (rawSchedules ?? []).map((s: any) => ({
      id: s.id,
      enrollmentId: s.enrollmentId ?? s.enrollment_id,
      lessonNumber: s.lessonNumber ?? s.lesson_number,
      scheduledAt: s.scheduledAt ?? s.scheduled_at,
    }));

    if (scheduleRows.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    // Step 3: Fetch course names
    const courseIds = Array.from(
      new Set(
        scheduleRows
          .map((s) => enrollmentMap.get(s.enrollmentId)?.courseId)
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

    const lessons = scheduleRows.map((s) => {
      const enrollment = enrollmentMap.get(s.enrollmentId);
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
