import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Fetch ebooks and join with courses to get course name
    const ebooks = await db
      .selectFrom("ebooks")
      .leftJoin("courses", "ebooks.courseId", "courses.id")
      .select([
        "ebooks.id",
        "ebooks.title",
        "ebooks.titleVi",
        "ebooks.description",
        "ebooks.descriptionVi",
        "ebooks.coverImageUrl",
        "ebooks.fileUrl",
        "ebooks.courseId",
        "ebooks.sortOrder",
        "courses.name as courseName",
      ])
      .where("ebooks.isActive", "=", true)
      .orderBy("ebooks.courseId")
      .orderBy("ebooks.sortOrder")
      .execute();

    // Get user's active or completed enrollments
    const enrollments = await db
      .selectFrom("courseEnrollments")
      .select(["id", "courseId"])
      .where("userId", "=", user.id)
      .where("status", "in", ["active", "completed"])
      .execute();

    const enrollmentIds = enrollments.map((e) => e.id);
    const enrollmentByCourseId = new Map(
      enrollments.map((e) => [e.courseId, e.id])
    );

    // Get lesson completions for these enrollments
    let lessonCompletions: { enrollmentId: number; lessonNumber: number }[] = [];
    if (enrollmentIds.length > 0) {
      lessonCompletions = await db
        .selectFrom("lessonCompletions")
        .select(["enrollmentId", "lessonNumber"])
        .where("enrollmentId", "in", enrollmentIds)
        .execute();
    }

    // Build a set of completed lessons: "enrollmentId-lessonNumber"
    const completedLessonsSet = new Set(
      lessonCompletions.map((lc) => `${lc.enrollmentId}-${lc.lessonNumber}`)
    );

    // Get lesson schedules for these enrollments where scheduledAt is in the past
    let lessonSchedules: { enrollmentId: number; lessonNumber: number }[] = [];
    if (enrollmentIds.length > 0) {
      lessonSchedules = await db
        .selectFrom("lessonSchedules")
        .select(["enrollmentId", "lessonNumber"])
        .where("enrollmentId", "in", enrollmentIds)
        .where("scheduledAt", "<", new Date())
        .execute();
    }

    // Build a set of scheduled past lessons: "enrollmentId-lessonNumber"
    const scheduledPastLessonsSet = new Set(
      lessonSchedules.map((ls) => `${ls.enrollmentId}-${ls.lessonNumber}`)
    );

    const resultEbooks = ebooks.map((ebook) => {
      let isUnlocked = false;

      // Unlock logic: courseId is null OR sortOrder is 0 OR there exists a lesson completion for this ebook
      if (ebook.courseId === null || ebook.sortOrder === 0) {
        isUnlocked = true;
      } else {
        const enrollmentId = enrollmentByCourseId.get(ebook.courseId);
        if (enrollmentId) {
          const key = `${enrollmentId}-${ebook.sortOrder}`;
          isUnlocked = completedLessonsSet.has(key) || scheduledPastLessonsSet.has(key);
        }
      }

      return {
        id: ebook.id,
        title: ebook.title,
        titleVi: ebook.titleVi,
        description: ebook.description,
        descriptionVi: ebook.descriptionVi,
        coverImageUrl: ebook.coverImageUrl,
        fileUrl: ebook.fileUrl,
        courseId: ebook.courseId,
        sortOrder: ebook.sortOrder,
        courseName: ebook.courseName,
        isUnlocked,
      };
    });

    return new Response(
      superjson.stringify({
        ebooks: resultEbooks,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error listing ebooks:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch ebooks" }),
      { status: 500 }
    );
  }
}