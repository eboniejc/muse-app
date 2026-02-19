import { db } from "../../helpers/db";
import { validateSheetsApiKey } from "../../helpers/validateSheetsApiKey";
import { OutputType } from "./export_POST.schema";
import superjson from "superjson";
import { supabaseAdmin } from "../../helpers/supabaseServer";

async function safeSelectAll(table: string) {
  try {
    return await db.selectFrom(table as any).selectAll().execute();
  } catch (error) {
    console.error(`Sheets export: failed to query table ${table}:`, error);
    return [];
  }
}

async function safeSelectCourseEnrollments() {
  const rows = await safeSelectAll("courseEnrollments");
  if (rows.length > 0) return rows;
  const { data, error } = await supabaseAdmin
    .from("courseEnrollments")
    .select("*");
  if (error) {
    console.error("Sheets export: failed Supabase query for courseEnrollments:", error);
    return [];
  }
  return data ?? [];
}

function readField<T = unknown>(row: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key] as T;
  }
  return undefined;
}

export async function handle(request: Request) {
  try {
    const validation = validateSheetsApiKey(request);
    if (!validation.valid) {
      return validation.response;
    }

    // Export each table safely so one schema mismatch doesn't break the whole export.
    const [
      courses,
      ebooks,
      rooms,
      roomBookings,
      courseEnrollments,
      lessonCompletions,
      lessonSchedules,
      users,
      userProfiles,
    ] = await Promise.all([
      safeSelectAll("courses"),
      safeSelectAll("ebooks"),
      safeSelectAll("rooms"),
      safeSelectAll("roomBookings"),
      safeSelectCourseEnrollments(),
      safeSelectAll("lessonCompletions"),
      safeSelectAll("lessonSchedules"),
      safeSelectAll("users"),
      safeSelectAll("userProfiles"),
    ]);

    const exportData = {
      courses,
      ebooks,
      rooms,
      roomBookings: roomBookings.map((row: any) => ({
        ...row,
        userName: row.userName ?? "",
        roomName: row.roomName ?? "",
      })),
      courseEnrollments: courseEnrollments.map((row: any) => {
        const userId = readField<string | number>(row, "userId", "user_id");
        const courseId = readField<string | number>(row, "courseId", "course_id");
        const user = (users ?? []).find(
          (u: any) => String(readField(u, "id")) === String(userId)
        );
        const course = (courses ?? []).find(
          (c: any) => String(readField(c, "id")) === String(courseId)
        );
        return {
          ...row,
          studentName:
            row.studentName ??
            user?.displayName ??
            user?.displayname ??
            user?.email ??
            "",
          studentEmail: row.studentEmail ?? user?.email ?? "",
          courseName: row.courseName ?? course?.name ?? "",
        };
      }),
      lessonCompletions,
      lessonSchedules: (() => {
        const existing = Array.isArray(lessonSchedules) ? lessonSchedules : [];
        const existingKeySet = new Set(
          existing.map((row: any) => {
            const enrollmentId = readField<string | number>(
              row,
              "enrollmentId",
              "enrollment_id"
            );
            const lessonNumber = readField<string | number>(
              row,
              "lessonNumber",
              "lesson_number"
            );
            return `${enrollmentId}-${lessonNumber}`;
          })
        );

        const courseMap = new Map(
          (courses ?? []).map((course: any) => [
            String(readField(course, "id")),
            Number(readField(course, "totalLessons", "total_lessons") ?? 0),
          ])
        );

        const templateRows: any[] = [];
        for (const enrollment of courseEnrollments ?? []) {
          const enrollmentId = readField<number | string>(enrollment, "id");
          const courseId = readField<number | string>(
            enrollment,
            "courseId",
            "course_id"
          );
          const totalLessons = courseMap.get(String(courseId)) ?? 0;
          for (let lessonNumber = 1; lessonNumber <= totalLessons; lessonNumber++) {
            const key = `${enrollmentId}-${lessonNumber}`;
            if (existingKeySet.has(key)) continue;
            templateRows.push({
              enrollmentId,
              lessonNumber,
              scheduledAt: null,
              notification1hId: null,
              notification24hId: null,
            });
          }
        }

        return [...existing, ...templateRows];
      })(),
      users,
      userProfiles,
    };

    return new Response(
      superjson.stringify({ data: exportData } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error exporting sheets data:", error);
    return new Response(
      superjson.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}
