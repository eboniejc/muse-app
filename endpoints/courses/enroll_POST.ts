import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./enroll_POST.schema";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    const course = await db
      .selectFrom("courses")
      .select(["id", "isActive", "maxStudents"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course || !course.isActive) {
      return new Response(
        superjson.stringify({ error: "Course not found or inactive" }),
        { status: 404 }
      );
    }

    const existingEnrollment = await db
      .selectFrom("courseEnrollments")
      .select("id")
      .where("userId", "=", user.id as any)
      .where("courseId", "=", courseId)
      .where("status", "in", ["active", "paused"])
      .executeTakeFirst();

    if (existingEnrollment) {
      return new Response(
        superjson.stringify({ error: "Already enrolled in this course" }),
        { status: 409 }
      );
    }

    if (course.maxStudents) {
      const currentEnrollments = await db
        .selectFrom("courseEnrollments")
        .select((eb) => eb.fn.count("id").as("count"))
        .where("courseId", "=", courseId)
        .where("status", "=", "active")
        .executeTakeFirst();

      if (Number(currentEnrollments?.count ?? 0) >= course.maxStudents) {
        return new Response(
          superjson.stringify({ error: "Course is full" }),
          { status: 400 }
        );
      }
    }

    const inserted = await db
      .insertInto("courseEnrollments")
      .values({
        userId: user.id,
        courseId,
        status: "active",
        enrolledAt: new Date(),
        progressPercentage: 0,
        updatedAt: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        enrollment: inserted,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error enrolling in course:", error);
    return new Response(
      superjson.stringify({ error: "Failed to enroll in course" }),
      { status: 500 }
    );
  }
}
