import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import { OutputType } from "./schedule_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

const ONE_HOUR_MS = 60 * 60 * 1000;

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

    if (user.role !== "instructor" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    // Fetch courses taught by this instructor
    const { data: instructorCourses, error: coursesErr } = await supabaseAdmin
      .from("courses")
      .select("id,name")
      .eq("instructorId", user.id as any);

    if (coursesErr && !isSchemaError(coursesErr)) throw coursesErr;

    const courses = instructorCourses ?? [];
    if (courses.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    const courseIds = courses.map((c: any) => c.id);
    const courseMap = new Map(courses.map((c: any) => [String(c.id), c.name]));

    // Fetch enrollments for these courses via Supabase
    const { data: rawEnrollments, error: enrollErr } = await supabaseAdmin
      .from("courseEnrollments")
      .select("id,userId,courseId")
      .in("courseId", courseIds as any[])
      .in("status", ["active", "completed"]);

    if (enrollErr && !isSchemaError(enrollErr)) throw enrollErr;

    const enrollments = rawEnrollments ?? [];
    if (enrollments.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    const enrollmentIds = enrollments.map((e: any) => e.id);
    const enrollmentMap = new Map(
      enrollments.map((e: any) => [String(e.id), e])
    );

    // Fetch student names
    const userIds = Array.from(new Set(enrollments.map((e: any) => e.userId)));
    const { data: rawUsers } = await supabaseAdmin
      .from("users")
      .select("id,displayName,email")
      .in("id", userIds as any[]);
    const userMap = new Map(
      (rawUsers ?? []).map((u: any) => [String(u.id), u])
    );

    // Fetch lesson schedules via Supabase (avoids Kysely camelCase→snake_case mismatch)
    const { data: rawSchedules, error: schedErr } = await supabaseAdmin
      .from("lessonSchedules")
      .select("id,enrollmentId,lessonNumber,scheduledAt")
      .in("enrollmentId", enrollmentIds as any[])
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

    // Fetch ebooks for all relevant courses
    const allCourseIds = [...new Set(scheduleRows.map((s) => {
      const e = enrollmentMap.get(String(s.enrollmentId));
      return e?.courseId;
    }).filter(Boolean))];

    let ebooks: any[] = [];
    if (allCourseIds.length > 0) {
      try {
        const rows = await db
          .selectFrom("ebooks")
          .select(["courseId", "sortOrder", "title", "fileUrl"])
          .where("courseId", "in", allCourseIds as any)
          .where("isActive", "=", true)
          .execute();
        ebooks = rows as any[];
      } catch {
        // ebooks table failure is non-fatal
      }
    }
    const ebooksByKey = new Map(
      ebooks.map((e: any) => [`${e.courseId}-${e.sortOrder}`, e])
    );

    const now = Date.now();
    const formattedLessons = scheduleRows.map((s) => {
      const enrollment = enrollmentMap.get(String(s.enrollmentId));
      const courseId = enrollment?.courseId ?? null;
      const student = userMap.get(String(enrollment?.userId));
      const ebook = ebooksByKey.get(`${courseId}-${s.lessonNumber}`);
      const scheduledMs = new Date(s.scheduledAt).getTime();
      return {
        id: s.id,
        enrollmentId: s.enrollmentId,
        lessonNumber: s.lessonNumber,
        scheduledAt: new Date(s.scheduledAt),
        courseName: courseId ? courseMap.get(String(courseId)) ?? "Course" : "Course",
        studentName: student?.displayName ?? null,
        studentEmail: student?.email ?? null,
        ebookTitle: ebook?.title ?? null,
        ebookUrl: ebook?.fileUrl ?? null,
        ebookUnlocked: Number.isFinite(scheduledMs) && scheduledMs + ONE_HOUR_MS <= now,
      };
    });

    return new Response(
      superjson.stringify({ lessons: formattedLessons } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error fetching instructor schedule:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
