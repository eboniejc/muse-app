import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./enrollments_GET.schema";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";

function isSchemaOrMissingTableError(error: unknown): boolean {
  const maybeErr = error as { code?: string; message?: string } | null;
  if (!maybeErr) return false;
  return (
    maybeErr.code === "42703" ||
    maybeErr.code === "42P01" ||
    maybeErr.code === "PGRST205" ||
    maybeErr.message?.includes("does not exist") === true ||
    maybeErr.message?.includes("schema cache") === true
  );
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const enrollments = await db
      .selectFrom("courseEnrollments")
      .innerJoin("courses", "courseEnrollments.courseId", "courses.id")
      .leftJoin("users", "courses.instructorId", "users.id")
      .select([
        "courseEnrollments.id",
        "courseEnrollments.status",
        "courseEnrollments.progressPercentage",
        "courseEnrollments.enrolledAt",
        "courseEnrollments.completedAt",
        "courseEnrollments.courseId",
        "courses.name as courseName",
        "courses.description as courseDescription",
        "courses.totalLessons",
        "users.displayName as instructorName",
      ])
      .where("courseEnrollments.userId", "=", user.id)
      .orderBy("courseEnrollments.enrolledAt", "desc")
      .execute();

    // Get completed lesson counts for each enrollment
    const enrollmentIds = enrollments.map((e) => e.id);
    
        let completedLessonCounts: { enrollmentId: number; count: number }[] = [];
    if (enrollmentIds.length > 0) {
      completedLessonCounts = await db
        .selectFrom("lessonCompletions")
        .select((eb) => [
          "enrollmentId",
          eb.fn.count<number>("id").as("count"),
        ])
        .where("enrollmentId", "in", enrollmentIds)
        .groupBy("enrollmentId")
        .execute();
    }

    const completedCountMap = new Map(
      completedLessonCounts.map((c) => [c.enrollmentId, Number(c.count)])
    );

    const result = enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      progressPercentage: e.progressPercentage,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      courseId: e.courseId,
      courseName: e.courseName,
      courseDescription: e.courseDescription,
      totalLessons: e.totalLessons,
      completedLessons: completedCountMap.get(e.id) || 0,
      instructorName: e.instructorName,
    }));

    return new Response(
      superjson.stringify({
        enrollments: result,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error fetching enrollments:", error);
    if (isSchemaOrMissingTableError(error)) {
      return new Response(
        superjson.stringify({ enrollments: [] } satisfies OutputType)
      );
    }
    return new Response(
      superjson.stringify({ error: "Failed to fetch enrollments" }),
      { status: 500 }
    );
  }
}
