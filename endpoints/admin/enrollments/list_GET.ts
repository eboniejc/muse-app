import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../../helpers/supabaseServer";

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());

    const queryInput = schema.parse({
        courseId: searchParams.courseId ? Number(searchParams.courseId) : undefined,
        status: searchParams.status || undefined
    });

    // Query both tables and merge — two tables exist due to naming inconsistency.
    let camelQuery = supabaseAdmin
      .from("courseEnrollments")
      .select("id, courseId, userId, status, enrolledAt, completedAt, progressPercentage")
      .order("enrolledAt", { ascending: false });
    let snakeQuery = supabaseAdmin
      .from("course_enrollments")
      .select("id, courseId:course_id, userId:user_id, status, enrolledAt:enrolled_at, completedAt:completed_at, progressPercentage:progress_percentage")
      .order("enrolled_at", { ascending: false });

    if (queryInput.courseId) {
      camelQuery = camelQuery.eq("courseId", queryInput.courseId as any);
      snakeQuery = snakeQuery.eq("course_id", queryInput.courseId as any);
    }
    if (queryInput.status) {
      camelQuery = camelQuery.eq("status", queryInput.status as any);
      snakeQuery = snakeQuery.eq("status", queryInput.status as any);
    }

    const [{ data: camelRows, error: camelErr }, { data: snakeRows }] = await Promise.all([camelQuery, snakeQuery]);
    if (camelErr) throw camelErr;

    const seen = new Set<string>();
    const enrollmentRows: any[] = [];
    for (const row of [...(camelRows ?? []), ...(snakeRows ?? [])]) {
      const id = String(row.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      enrollmentRows.push(row);
    }
    enrollmentRows.sort((a, b) => new Date(b.enrolledAt ?? 0).getTime() - new Date(a.enrolledAt ?? 0).getTime());

    if (enrollmentRows.length === 0) {
      return new Response(
        superjson.stringify({ enrollments: [] } satisfies OutputType)
      );
    }

    // Fetch courses and users in parallel
    const courseIds = [...new Set(enrollmentRows.map((e: any) => e.courseId))];
    const userIds = [...new Set(enrollmentRows.map((e: any) => e.userId))];

    const [{ data: coursesData }, { data: usersData }] = await Promise.all([
      supabaseAdmin.from("courses").select("id, name, totalLessons, skillLevel").in("id", courseIds as any[]),
      supabaseAdmin.from("users").select("id, displayName, email").in("id", userIds as any[]),
    ]);

    const courseMap = new Map((coursesData ?? []).map((c: any) => [c.id, c]));
    const userMap = new Map((usersData ?? []).map((u: any) => [u.id, u]));

    const enrollmentIds = enrollmentRows.map((e: any) => e.id);

    // Fetch lesson completions via Supabase
    const { data: completionsData } = await supabaseAdmin
      .from("lessoncompletions")
      .select("enrollmentId, lessonNumber, completedAt")
      .in("enrollmentId", enrollmentIds as any[]);
    const allCompletions = (completionsData ?? []).map((c: any) => ({
      enrollmentId: c.enrollmentId ?? c.enrollment_id,
      lessonNumber: c.lessonNumber ?? c.lesson_number,
      completedAt: c.completedAt ?? c.completed_at,
    }));

    // Fetch lesson schedules via Supabase (same path as the sheet import writer)
    // to avoid ORM camelCase→snake_case table name mismatch with lessonSchedules.
    const { data: rawSchedules } = await supabaseAdmin
      .from("lessonSchedules")
      .select("enrollmentId, lessonNumber, scheduledAt")
      .in("enrollmentId", enrollmentIds as any[]);
    const allSchedules = (rawSchedules ?? []).map((s: any) => ({
      enrollmentId: s.enrollmentId ?? s.enrollment_id,
      lessonNumber: s.lessonNumber ?? s.lesson_number,
      scheduledAt: s.scheduledAt ?? s.scheduled_at,
    }));

    // Map completions and schedules to enrollments
    const enrollmentsWithDetails = enrollmentRows.map((enrollment: any) => {
      const course = courseMap.get(enrollment.courseId);
      const user = userMap.get(enrollment.userId);
      const completions = allCompletions.filter(
        (c) => c.enrollmentId === enrollment.id
      );
      const schedules = allSchedules.filter(
        (s) => s.enrollmentId === enrollment.id
      );

      return {
        id: enrollment.id,
        courseId: enrollment.courseId,
        courseName: course?.name ?? "",
        totalLessons: course?.totalLessons ?? 0,
        skillLevel: course?.skillLevel ?? null,
        userId: enrollment.userId,
        studentName: user?.displayName ?? user?.email ?? "",
        studentEmail: user?.email ?? "",
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt ? new Date(enrollment.enrolledAt) : new Date(),
        completedAt: enrollment.completedAt ? new Date(enrollment.completedAt) : null,
        progressPercentage: enrollment.progressPercentage ?? 0,
        completedLessons: completions.length,
        lessonCompletions: completions.map((c) => ({
          lessonNumber: c.lessonNumber,
          completedAt: new Date(c.completedAt),
        })),
        lessonSchedules: schedules.map((s) => ({
          lessonNumber: s.lessonNumber,
          scheduledAt: new Date(s.scheduledAt),
        })),
      };
    });

    return new Response(
      superjson.stringify({
        enrollments: enrollmentsWithDetails,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error fetching admin enrollments:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}