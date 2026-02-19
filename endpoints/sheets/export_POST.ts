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

async function safeSelectUsers() {
  const rows = await safeSelectAll("users");
  if (rows.length > 0) return rows;
  const { data, error } = await supabaseAdmin.from("users").select("*");
  if (error) {
    console.error("Sheets export: failed Supabase query for users:", error);
    return [];
  }
  return data ?? [];
}

async function safeSelectCourses() {
  const rows = await safeSelectAll("courses");
  if (rows.length > 0) return rows;
  const { data, error } = await supabaseAdmin.from("courses").select("*");
  if (error) {
    console.error("Sheets export: failed Supabase query for courses:", error);
    return [];
  }
  return data ?? [];
}

async function safeSelectEbooks() {
  const rows = await safeSelectAll("ebooks");
  if (rows.length > 0) return rows;

  let { data, error } = await supabaseAdmin.from("ebooks").select("*");
  if (error) {
    const snake = await supabaseAdmin.from("e_books").select("*");
    data = snake.data;
    error = snake.error;
  }
  if (error) {
    console.error("Sheets export: failed Supabase query for ebooks:", error);
    return [];
  }
  return data ?? [];
}

async function safeSelectLessonSchedules() {
  const rows = await safeSelectAll("lessonSchedules");
  if (rows.length > 0) return rows;

  let { data, error } = await supabaseAdmin.from("lessonSchedules").select("*");
  if (error) {
    const snake = await supabaseAdmin.from("lesson_schedules").select("*");
    data = snake.data;
    error = snake.error;
  }
  if (error) {
    console.error("Sheets export: failed Supabase query for lesson schedules:", error);
    return [];
  }
  return data ?? [];
}

async function safeSelectUserProfiles() {
  const rows = await safeSelectAll("userProfiles");
  if (rows.length > 0) return rows;

  let { data, error } = await supabaseAdmin.from("userProfiles").select("*");
  if (error) {
    const lower = await supabaseAdmin.from("userprofiles").select("*");
    data = lower.data;
    error = lower.error;
  }
  if (error) {
    const snake = await supabaseAdmin.from("user_profiles").select("*");
    data = snake.data;
    error = snake.error;
  }
  if (error) {
    console.error("Sheets export: failed Supabase query for user profiles:", error);
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
      safeSelectCourses(),
      safeSelectEbooks(),
      safeSelectAll("rooms"),
      safeSelectAll("roomBookings"),
      safeSelectCourseEnrollments(),
      safeSelectAll("lessonCompletions"),
      safeSelectLessonSchedules(),
      safeSelectUsers(),
      safeSelectUserProfiles(),
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

        const mergedRows = [...existing, ...templateRows];
        const enrollmentMap = new Map(
          (courseEnrollments ?? []).map((enrollment: any) => [
            String(readField(enrollment, "id")),
            enrollment,
          ])
        );

        return mergedRows.map((row: any) => {
          const enrollmentId = readField<string | number>(
            row,
            "enrollmentId",
            "enrollment_id"
          );
          const enrollment = enrollmentMap.get(String(enrollmentId));
          const userId = readField<string | number>(
            enrollment ?? {},
            "userId",
            "user_id"
          );
          const courseId = readField<string | number>(
            enrollment ?? {},
            "courseId",
            "course_id"
          );
          const user = (users ?? []).find(
            (u: any) => String(readField(u, "id")) === String(userId)
          );
          const course = (courses ?? []).find(
            (c: any) => String(readField(c, "id")) === String(courseId)
          );

          return {
            ...row,
            userId,
            courseId,
            studentName:
              row.studentName ??
              user?.displayName ??
              user?.displayname ??
              user?.email ??
              "",
            studentEmail: row.studentEmail ?? user?.email ?? "",
            courseName: row.courseName ?? course?.name ?? "",
          };
        });
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
