import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./enrollments_GET.schema";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const { data: enrollments, error: enrollmentErr } = await supabaseAdmin
      .from("courseEnrollments")
      .select("id,status,progressPercentage,enrolledAt,completedAt,courseId")
      .eq("userId", user.id)
      .order("enrolledAt", { ascending: false });

    if (enrollmentErr) {
      throw enrollmentErr;
    }

    const rows = enrollments ?? [];
    if (rows.length === 0) {
      return new Response(
        superjson.stringify({ enrollments: [] } satisfies OutputType)
      );
    }

    const courseIds = Array.from(new Set(rows.map((e: any) => e.courseId)));
    const enrollmentIds = rows.map((e: any) => e.id);

    const [{ data: courses, error: coursesErr }, { data: completions, error: completionErr }] =
      await Promise.all([
        supabaseAdmin
          .from("courses")
          .select("id,name,description,totalLessons,instructorId")
          .in("id", courseIds),
        supabaseAdmin
          .from("lessonCompletions")
          .select("id,enrollmentId")
          .in("enrollmentId", enrollmentIds),
      ]);

    if (coursesErr) throw coursesErr;
    if (completionErr) throw completionErr;

    const instructorIds = Array.from(
      new Set((courses ?? []).map((c: any) => c.instructorId).filter(Boolean))
    );

    let instructors: any[] = [];
    if (instructorIds.length > 0) {
      const { data: users, error: usersErr } = await supabaseAdmin
        .from("users")
        .select("id,displayName,displayname")
        .in("id", instructorIds);
      if (usersErr) throw usersErr;
      instructors = users ?? [];
    }

    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c]));
    const instructorMap = new Map(
      instructors.map((u: any) => [u.id, u.displayName ?? u.displayname ?? null])
    );
    const completionCountMap = new Map<number, number>();
    for (const row of completions ?? []) {
      completionCountMap.set(
        row.enrollmentId,
        (completionCountMap.get(row.enrollmentId) ?? 0) + 1
      );
    }

    const result = rows.map((e: any) => {
      const course = courseMap.get(e.courseId);
      const instructorName = course
        ? instructorMap.get(course.instructorId) ?? null
        : null;
      return {
        id: e.id,
        status: e.status,
        progressPercentage: e.progressPercentage,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
        courseId: e.courseId,
        courseName: course?.name ?? "Unknown course",
        courseDescription: course?.description ?? null,
        totalLessons: course?.totalLessons ?? 0,
        completedLessons: completionCountMap.get(e.id) ?? 0,
        instructorName,
      };
    });

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
    return new Response(
      superjson.stringify({ error: "Failed to fetch enrollments" }),
      { status: 500 }
    );
  }
}

