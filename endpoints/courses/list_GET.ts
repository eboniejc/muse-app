import { supabaseAdmin } from "../../helpers/supabaseServer";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

const csvFallbackCourses: OutputType["courses"] = [];

function isMissingTableError(error: unknown, tableName: string): boolean {
  const maybeErr = error as { code?: string; message?: string } | null;
  if (!maybeErr) return false;
  return (
    maybeErr.code === "PGRST205" &&
    maybeErr.message?.includes(`public.${tableName}`) === true
  );
}

export async function handle(request: Request) {
  try {
    // Public endpoint - fetch active courses with instructor info.
    // Retry with alternate user avatar column names for schema compatibility.
    let { data: courses, error: coursesErr } = await supabaseAdmin
      .from('courses')
      .select('id,name,description,totalLessons,maxStudents,skillLevel,price,isActive,instructorId,users(displayname,avatarUrl)')
      .eq('isActive', true);

    if (coursesErr?.code === "42703") {
      const retry = await supabaseAdmin
        .from('courses')
        .select('id,name,description,totalLessons,maxStudents,skillLevel,price,isActive,instructorId,users(displayname,avatarurl)')
        .eq('isActive', true);
      courses = retry.data;
      coursesErr = retry.error;
    }

    if (coursesErr?.code === "42703") {
      const retry = await supabaseAdmin
        .from('courses')
        .select('id,name,description,totalLessons,maxStudents,skillLevel,price,isActive,instructorId,users(displayname)')
        .eq('isActive', true);
      courses = retry.data;
      coursesErr = retry.error;
    }

    if (coursesErr) {
      if (isMissingTableError(coursesErr, "courses")) {
        return new Response(
          superjson.stringify({
            courses: csvFallbackCourses,
          } satisfies OutputType)
        );
      }
      throw coursesErr;
    }

    if (!courses || courses.length === 0) {
      return new Response(
        superjson.stringify({
          courses: [],
        } satisfies OutputType)
      );
    }

    // Get enrollment counts for each course
    const { data: enrollmentCounts, error: enrollErr } = await supabaseAdmin
      .from('courseEnrollments')
      .select('courseId')
      .eq('status', 'active');

    if (enrollErr && !isMissingTableError(enrollErr, "courseEnrollments")) {
      throw enrollErr;
    }

    const countMap = new Map<string, number>();
    (enrollmentCounts || []).forEach((e: any) => {
      countMap.set(e.courseId, (countMap.get(e.courseId) || 0) + 1);
    });

    const mappedCourses = (courses || []).map((course: any) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      totalLessons: course.totalLessons,
      maxStudents: course.maxStudents,
      skillLevel: course.skillLevel,
      price: course.price ? String(course.price) : null,
      isActive: course.isActive,
      instructorId: course.instructorId,
      instructorName: course.users?.displayname || null,
      instructorAvatar: course.users?.avatarUrl || course.users?.avatarurl || null,
      enrolledCount: countMap.get(course.id) || 0,
    }));

    // Defensive dedupe: if duplicate active rows exist for the same course name,
    // keep a single canonical row in API output.
    const dedupedByName = new Map<string, (typeof mappedCourses)[number]>();
    for (const course of mappedCourses) {
      const key = String(course.name ?? "").trim().toLowerCase();
      const existing = dedupedByName.get(key);
      if (!existing) {
        dedupedByName.set(key, course);
        continue;
      }

      const preferCurrent =
        (course.enrolledCount ?? 0) > (existing.enrolledCount ?? 0) ||
        ((course.enrolledCount ?? 0) === (existing.enrolledCount ?? 0) &&
          Number(course.id) < Number(existing.id));

      if (preferCurrent) {
        dedupedByName.set(key, course);
      }
    }
    const resultCourses = Array.from(dedupedByName.values());

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
