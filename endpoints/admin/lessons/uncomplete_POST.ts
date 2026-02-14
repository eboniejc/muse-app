import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./uncomplete_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // 1. Delete lesson completion
    await db
      .deleteFrom("lessonCompletions")
      .where("enrollmentId", "=", input.enrollmentId)
      .where("lessonNumber", "=", input.lessonNumber)
      .execute();

    // 2. Fetch enrollment info to recalculate progress
    const enrollment = await db
      .selectFrom("courseEnrollments")
      .innerJoin("courses", "courseEnrollments.courseId", "courses.id")
      .select(["courseEnrollments.id", "courseEnrollments.status", "courses.totalLessons"])
      .where("courseEnrollments.id", "=", input.enrollmentId)
      .executeTakeFirstOrThrow();

    // 3. Count completed lessons for this enrollment
    const completionCount = await db
      .selectFrom("lessonCompletions")
      .where("enrollmentId", "=", input.enrollmentId)
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirst();
    
    const completedLessons = Number(completionCount?.count ?? 0);
    const totalLessons = enrollment.totalLessons;
    const progressPercentage = Math.min(
      100,
      Math.round((completedLessons / totalLessons) * 100)
    );

    // 4. Update enrollment
    let statusUpdate: any = {
      progressPercentage,
    };

    // If it was completed, we might need to revert it to active if it's no longer 100%
    // Though practically if we are uncompleting a lesson, it shouldn't remain 'completed' unless there are 0 lessons (impossible)
    if (enrollment.status === "completed" && completedLessons < totalLessons) {
      statusUpdate = {
        ...statusUpdate,
        status: "active",
        completedAt: null,
      };
    }

    await db
      .updateTable("courseEnrollments")
      .set(statusUpdate)
      .where("id", "=", input.enrollmentId)
      .execute();

    return new Response(
      superjson.stringify({
        success: true,
        completedLessons,
        totalLessons,
        progressPercentage,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error uncompleting lesson:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}