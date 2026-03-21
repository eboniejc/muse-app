import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { OutputType } from "./schedule_GET.schema";
import superjson from "superjson";

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "instructor" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    // All scheduled lessons for courses taught by this instructor
    const lessons = await db
      .selectFrom("lessonSchedules")
      .innerJoin(
        "courseEnrollments",
        "courseEnrollments.id",
        "lessonSchedules.enrollmentId"
      )
      .innerJoin("courses", (join) =>
        join
          .onRef("courses.id", "=", "courseEnrollments.courseId")
          .on("courses.instructorId", "=", user.id)
      )
      .innerJoin("users", "users.id", "courseEnrollments.userId")
      .select([
        "lessonSchedules.id",
        "lessonSchedules.enrollmentId",
        "lessonSchedules.lessonNumber",
        "lessonSchedules.scheduledAt",
        "courses.id as courseId",
        "courses.name as courseName",
        "users.displayName as studentName",
        "users.email as studentEmail",
      ])
      .orderBy("lessonSchedules.scheduledAt", "asc")
      .execute();

    if (lessons.length === 0) {
      return new Response(
        superjson.stringify({ lessons: [] } satisfies OutputType)
      );
    }

    // Fetch ebooks for all relevant courses
    const allCourseIds = [...new Set(lessons.map((l: any) => l.courseId))];
    const ebooks = await db
      .selectFrom("ebooks")
      .select(["courseId", "sortOrder", "title", "fileUrl"])
      .where("courseId", "in", allCourseIds)
      .where("isActive", "=", true)
      .execute();

    const ebooksByKey = new Map(
      ebooks.map((e: any) => [`${e.courseId}-${e.sortOrder}`, e])
    );

    const now = Date.now();
    const formattedLessons = lessons.map((l: any) => {
      const ebook = ebooksByKey.get(`${l.courseId}-${l.lessonNumber}`);
      const scheduledMs = new Date(l.scheduledAt).getTime();
      return {
        id: l.id,
        enrollmentId: l.enrollmentId,
        lessonNumber: l.lessonNumber,
        scheduledAt: new Date(l.scheduledAt),
        courseName: l.courseName,
        studentName: l.studentName,
        studentEmail: l.studentEmail,
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
