import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { schema, OutputType } from "./complete_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // 1. Insert lesson completion (idempotent via ON CONFLICT)
    await db
      .insertInto("lessonCompletions")
      .values({
        enrollmentId: input.enrollmentId,
        lessonNumber: input.lessonNumber,
        markedBy: user.id,
        completedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.column("enrollmentId").column("lessonNumber").doNothing()
      )
      .execute();

    // 2. Fetch enrollment + course from both tables
    let enrollmentTable = "courseEnrollments";
    let { data: enrollmentData } = await supabaseAdmin
      .from("courseEnrollments")
      .select("id, courseId, courses(totalLessons)")
      .eq("id", input.enrollmentId as any)
      .maybeSingle();
    if (!enrollmentData) {
      enrollmentTable = "course_enrollments";
      const { data } = await supabaseAdmin
        .from("course_enrollments")
        .select("id, courseId:course_id, courses(totalLessons:total_lessons)")
        .eq("id", input.enrollmentId as any)
        .maybeSingle();
      enrollmentData = data;
    }
    if (!enrollmentData) throw new Error("Enrollment not found");
    const totalLessons = Number((enrollmentData as any).courses?.totalLessons ?? (enrollmentData as any).courses?.total_lessons ?? 0);

    // 3. Count completed lessons for this enrollment
    const completionCount = await db
      .selectFrom("lessonCompletions")
      .where("enrollmentId", "=", input.enrollmentId)
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirst();

    const completedLessons = Number(completionCount?.count ?? 0);
    const progressPercentage = Math.min(
      100,
      Math.round((completedLessons / totalLessons) * 100)
    );

    // 4. Update enrollment in whichever table it came from
    let statusUpdate: any = { progressPercentage };
    if (completedLessons >= totalLessons) {
      statusUpdate = { ...statusUpdate, status: "completed", completedAt: new Date().toISOString() };
    }

    await supabaseAdmin
      .from(enrollmentTable as any)
      .update(enrollmentTable === "courseEnrollments" ? statusUpdate : {
        progress_percentage: statusUpdate.progressPercentage,
        ...(statusUpdate.status ? { status: statusUpdate.status, completed_at: statusUpdate.completedAt } : {}),
      })
      .eq("id", input.enrollmentId as any);

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
    console.error("Error completing lesson:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}