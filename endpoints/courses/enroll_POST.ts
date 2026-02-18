import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./enroll_POST.schema";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("id,isActive,maxStudents")
      .eq("id", courseId)
      .limit(1)
      .maybeSingle();

    if (courseErr) throw courseErr;

    if (!course || !course.isActive) {
      return new Response(
        superjson.stringify({ error: "Course not found or inactive" }),
        { status: 404 }
      );
    }

    // Check if already enrolled
    const { data: existingEnrollment, error: existingErr } = await supabaseAdmin
      .from("courseEnrollments")
      .select("id")
      .eq("userId", user.id)
      .eq("courseId", courseId)
      .in("status", ["active", "paused"])
      .limit(1)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existingEnrollment) {
      return new Response(
        superjson.stringify({ error: "Already enrolled in this course" }),
        { status: 409 }
      );
    }

    // Check capacity if maxStudents is set
    if (course.maxStudents) {
      const { count, error: countErr } = await supabaseAdmin
        .from("courseEnrollments")
        .select("id", { count: "exact", head: true })
        .eq("courseId", courseId)
        .eq("status", "active");

      if (countErr) throw countErr;
      if (Number(count ?? 0) >= course.maxStudents) {
        return new Response(
          superjson.stringify({ error: "Course is full" }),
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("courseEnrollments")
      .insert({
        userId: user.id,
        courseId: courseId,
        status: "active",
        enrolledAt: now,
        progressPercentage: 0,
        updatedAt: now,
      })
      .select("*")
      .limit(1)
      .maybeSingle();

    if (insertErr) throw insertErr;
    if (!inserted) throw new Error("Enrollment insert returned no row");

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
