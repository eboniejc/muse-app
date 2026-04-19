import { db } from "../../../helpers/db";
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
    
    // Validate inputs via schema, although GET query params need manual parsing usually, 
    // but here we can just cast or parse a constructed object.
    const queryInput = schema.parse({
        courseId: searchParams.courseId ? Number(searchParams.courseId) : undefined,
        status: searchParams.status || undefined
    });

    let query = db
      .selectFrom("courseEnrollments")
      .innerJoin("courses", "courseEnrollments.courseId", "courses.id")
      .innerJoin("users", "courseEnrollments.userId", "users.id")
      .select([
        "courseEnrollments.id",
        "courseEnrollments.courseId",
        "courseEnrollments.userId",
        "courseEnrollments.status",
        "courseEnrollments.enrolledAt",
        "courseEnrollments.completedAt",
        "courseEnrollments.progressPercentage",
        "courses.name as courseName",
        "courses.totalLessons",
        "courses.skillLevel",
        "users.displayName as studentName",
        "users.email as studentEmail",
      ])
      .orderBy("courseEnrollments.enrolledAt", "desc");

    if (queryInput.courseId) {
      query = query.where("courseEnrollments.courseId", "=", queryInput.courseId);
    }

    if (queryInput.status) {
      // @ts-expect-error - status string literal mismatch is fine here as it's validated by logic elsewhere or loose string
      query = query.where("courseEnrollments.status", "=", queryInput.status);
    }

    const enrollments = await query.execute();

    if (enrollments.length === 0) {
      return new Response(
        superjson.stringify({ enrollments: [] } satisfies OutputType)
      );
    }

    const enrollmentIds = enrollments.map((e) => e.id);

    // Fetch lesson completions for these enrollments
    const allCompletions = await db
      .selectFrom("lessonCompletions")
      .select(["enrollmentId", "lessonNumber", "completedAt"])
      .where("enrollmentId", "in", enrollmentIds)
      .execute();

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
    const enrollmentsWithDetails = enrollments.map((enrollment) => {
      const completions = allCompletions.filter(
        (c) => c.enrollmentId === enrollment.id
      );
      const schedules = allSchedules.filter(
        (s) => s.enrollmentId === enrollment.id
      );

      return {
        id: enrollment.id,
        courseId: enrollment.courseId,
        courseName: enrollment.courseName,
        totalLessons: enrollment.totalLessons,
        skillLevel: enrollment.skillLevel,
        userId: enrollment.userId,
        studentName: enrollment.studentName,
        studentEmail: enrollment.studentEmail,
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