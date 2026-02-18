import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./enroll_POST.schema";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";

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
    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    let course: any;
    try {
      course = await db
        .selectFrom("courses")
        .select(["id", "isActive", "maxStudents"])
        .where("id", "=", courseId)
        .executeTakeFirst();
    } catch (error) {
      if (!isSchemaOrMissingTableError(error)) throw error;
      const { data, error: restErr } = await supabaseAdmin
        .from("courses")
        .select("id,isActive,maxStudents")
        .eq("id", courseId)
        .limit(1)
        .maybeSingle();
      if (restErr) throw restErr;
      course = data;
    }

    if (!course || !course.isActive) {
      return new Response(
        superjson.stringify({ error: "Course not found or inactive" }),
        { status: 404 }
      );
    }

    let existingEnrollment: any;
    try {
      existingEnrollment = await db
        .selectFrom("courseEnrollments")
        .select("id")
        .where("userId", "=", user.id as any)
        .where("courseId", "=", courseId)
        .where("status", "in", ["active", "paused"])
        .executeTakeFirst();
    } catch (error) {
      if (!isSchemaOrMissingTableError(error)) throw error;
      const { data, error: restErr } = await supabaseAdmin
        .from("courseEnrollments")
        .select("id")
        .eq("userId", user.id as any)
        .eq("courseId", courseId)
        .in("status", ["active", "paused"])
        .limit(1)
        .maybeSingle();
      if (restErr) throw restErr;
      existingEnrollment = data;
    }

    if (existingEnrollment) {
      return new Response(
        superjson.stringify({ error: "Already enrolled in this course" }),
        { status: 409 }
      );
    }

    if (course.maxStudents) {
      let count = 0;
      try {
        const currentEnrollments = await db
          .selectFrom("courseEnrollments")
          .select((eb) => eb.fn.count("id").as("count"))
          .where("courseId", "=", courseId)
          .where("status", "=", "active")
          .executeTakeFirst();
        count = Number(currentEnrollments?.count ?? 0);
      } catch (error) {
        if (!isSchemaOrMissingTableError(error)) throw error;
        const { count: restCount, error: restErr } = await supabaseAdmin
          .from("courseEnrollments")
          .select("id", { count: "exact", head: true })
          .eq("courseId", courseId)
          .eq("status", "active");
        if (restErr) throw restErr;
        count = Number(restCount ?? 0);
      }

      if (count >= course.maxStudents) {
        return new Response(
          superjson.stringify({ error: "Course is full" }),
          { status: 400 }
        );
      }
    }

    let inserted: any;
    try {
      inserted = await db
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
    } catch (error) {
      if (!isSchemaOrMissingTableError(error)) throw error;
      const now = new Date().toISOString();
      const { data, error: restErr } = await supabaseAdmin
        .from("courseEnrollments")
        .insert({
          userId: user.id as any,
          courseId,
          status: "active",
          enrolledAt: now,
          progressPercentage: 0,
          updatedAt: now,
        })
        .select("*")
        .limit(1)
        .maybeSingle();
      if (restErr) throw restErr;
      if (!data) throw new Error("Enrollment insert returned no row");
      inserted = data;
    }

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
