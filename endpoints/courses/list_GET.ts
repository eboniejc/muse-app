import { db } from "../../helpers/db";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    // Public endpoint

    // Join with users to get instructor name
    // Also count enrollments for each course
    const courses = await db
      .selectFrom("courses")
      .leftJoin("users", "courses.instructorId", "users.id")
      .select([
        "courses.id",
        "courses.name",
        "courses.description",
        "courses.totalLessons",
        "courses.maxStudents",
        "courses.skillLevel",
        "courses.price",
        "courses.isActive",
        "courses.instructorId",
        "users.displayName as instructorName",
        "users.avatarUrl as instructorAvatar",
      ])
      .where("courses.isActive", "=", true)
      .execute();

    // Get enrollment counts separately or via subquery.
    // Doing a separate query for counts is often cleaner if we don't want complex group bys with all columns
    const enrollmentCounts = await db
      .selectFrom("courseEnrollments")
      .select((eb) => [
        "courseId",
        eb.fn.count<number>("id").as("count"),
      ])
      .where("status", "=", "active")
      .groupBy("courseId")
      .execute();

    const countMap = new Map(
      enrollmentCounts.map((c) => [c.courseId, Number(c.count)])
    );

    const resultCourses = courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      totalLessons: course.totalLessons,
      maxStudents: course.maxStudents,
      skillLevel: course.skillLevel,
      price: course.price ? String(course.price) : null,
      isActive: course.isActive,
      instructorId: course.instructorId,
      instructorName: course.instructorName,
      instructorAvatar: course.instructorAvatar,
      enrolledCount: countMap.get(course.id!) || 0,
    }));

    return new Response(
      superjson.stringify({
        courses: resultCourses,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error listing courses:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch courses" }),
      { status: 500 }
    );
  }
}