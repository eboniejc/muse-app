import { db } from "../../helpers/db";
import { validateSheetsApiKey } from "../../helpers/validateSheetsApiKey";
import { OutputType } from "./export_POST.schema";
import superjson from "superjson";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import { getModuleBoundaries } from "../../helpers/courseModules";

const MAX_LESSONS = 33;

async function safeSelectAll(table: string) {
  try {
    return await db.selectFrom(table as any).selectAll().execute();
  } catch (error) {
    const code = (error as any)?.code;
    const message = String((error as any)?.message ?? "");
    const isMissingRelation =
      code === "42P01" || message.includes("does not exist") || message.includes("relation");
    if (!isMissingRelation) {
      console.error(`Sheets export: failed to query table ${table}:`, error);
    }
    return [];
  }
}

async function safeSelectCourseEnrollments() {
  // Query both tables and merge, deduplicating by id.
  // Kysely's CamelCasePlugin translates "courseEnrollments" → "course_enrollments",
  // so we use Supabase directly for both to avoid that collision.
  const [camel, snake] = await Promise.all([
    supabaseAdmin.from("courseEnrollments").select("*"),
    supabaseAdmin.from("course_enrollments").select("*"),
  ]);

  if (camel.error) {
    console.error("Sheets export: failed Supabase query for courseEnrollments:", camel.error);
  }
  if (snake.error) {
    console.error("Sheets export: failed Supabase query for course_enrollments:", snake.error);
  }

  const seen = new Set<string>();
  const merged: any[] = [];
  for (const row of [...(camel.data ?? []), ...(snake.data ?? [])]) {
    const id = String(row.id ?? row.ID ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
  }
  return merged;
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
  // Prefer Supabase here because sheet import/delete paths also write through Supabase.
  // This keeps pull/export consistent with what the app UI shows after a push.
  let { data, error } = await supabaseAdmin.from("lessonSchedules").select("*");
  if (error) {
    const snake = await supabaseAdmin.from("lesson_schedules").select("*");
    data = snake.data;
    error = snake.error;
  }
  if (!error && data) {
    return data;
  }

  const rows = await safeSelectAll("lessonSchedules");
  if (rows.length > 0) return rows;

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

async function safeSelectEvents() {
  const rows = await safeSelectAll("events");
  if (rows.length > 0) return rows;

  const { data, error } = await supabaseAdmin.from("events").select("*");
  if (error) {
    console.error("Sheets export: failed Supabase query for events:", error);
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

function buildFlattenedEnrollments(input: {
  courses: any[];
  courseEnrollments: any[];
  lessonSchedules: any[];
  ebooks: any[];
  users: any[];
  userProfiles: any[];
  lessonCancellations: any[];
}): Record<string, unknown>[] {
  const { courses, courseEnrollments, lessonSchedules, ebooks, users, userProfiles, lessonCancellations } = input;
  const nowMs = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  const cancelledSet = new Set<string>();
  for (const row of lessonCancellations ?? []) {
    const eid = readField<string | number>(row, "enrollmentId");
    const ln = readField<string | number>(row, "lessonNumber");
    if (eid && ln) cancelledSet.add(`${eid}-${ln}`);
  }

  const courseById = new Map(
    (courses ?? []).map((row: any) => [String(readField(row, "id")), row])
  );
  const userById = new Map(
    (users ?? []).map((row: any) => [String(readField(row, "id")), row])
  );
  const instructorById = new Map(
    (users ?? []).map((row: any) => [String(readField(row, "id")), row])
  );
  const profileByUserId = new Map(
    (userProfiles ?? []).map((row: any) => [
      String(readField(row, "userId", "user_id")),
      row,
    ])
  );

  const scheduleByEnrollmentLesson = new Map<string, any>();
  for (const row of lessonSchedules ?? []) {
    const enrollmentId = readField<string | number>(row, "enrollmentId", "enrollment_id");
    const lessonNumber = Number(readField(row, "lessonNumber", "lesson_number") ?? 0);
    if (!enrollmentId || !lessonNumber) continue;
    scheduleByEnrollmentLesson.set(`${enrollmentId}-${lessonNumber}`, row);
  }

  const ebookByCourseLesson = new Map<string, any>();
  for (const row of ebooks ?? []) {
    const isActive = readField<boolean | null>(row, "isActive", "is_active");
    if (isActive === false) continue;
    const courseId = readField<string | number>(row, "courseId", "course_id");
    const sortOrder = Number(readField(row, "sortOrder", "sort_order") ?? 0);
    if (!courseId || !sortOrder) continue;
    const key = `${courseId}-${sortOrder}`;
    if (!ebookByCourseLesson.has(key)) {
      ebookByCourseLesson.set(key, row);
    }
  }

  const sortedEnrollments = [...(courseEnrollments ?? [])].sort(
    (a, b) => Number(readField(a, "id")) - Number(readField(b, "id"))
  );

  return sortedEnrollments.map((enrollment: any) => {
    const enrollmentId = readField<string | number>(enrollment, "id");
    const userId = readField<string | number>(enrollment, "userId", "user_id");
    const courseId = readField<string | number>(enrollment, "courseId", "course_id");

    const course = courseById.get(String(courseId));
    const user = userById.get(String(userId));
    const profile = profileByUserId.get(String(userId));
    const instructorId = readField<string | number>(course ?? {}, "instructorId", "instructor_id");
    const instructor = instructorId ? instructorById.get(String(instructorId)) : null;

    const row: Record<string, unknown> = {
      enrollmentId,
      userId,
      courseId,
      studentName:
        readField(profile ?? {}, "fullName", "full_name") ??
        readField(user ?? {}, "displayName", "displayname") ??
        readField(user ?? {}, "email") ??
        "",
      phone:
        readField(profile ?? {}, "phoneNumber", "phone_number") ??
        readField(user ?? {}, "whatsappNumber", "whatsapp_number") ??
        "",
      email: readField(user ?? {}, "email") ?? "",
      courseName: readField(course ?? {}, "name") ?? "",
      totalLessons: Number(readField(course ?? {}, "totalLessons", "total_lessons") ?? 0),
      enrollmentStatus: readField(enrollment, "status") ?? "active",
      instructorId: instructorId ?? "",
      instructorName: readField(instructor ?? {}, "displayName", "displayname") ?? "",
      instructorEmail: readField(instructor ?? {}, "email") ?? "",
    };

    for (let i = 1; i <= MAX_LESSONS; i++) {
      const schedule = scheduleByEnrollmentLesson.get(`${enrollmentId}-${i}`);
      const ebook = ebookByCourseLesson.get(`${courseId}-${i}`);
      const scheduledAt = readField<string | null>(schedule ?? {}, "scheduledAt", "scheduled_at") ?? null;
      const scheduledMs = scheduledAt ? new Date(scheduledAt).getTime() : NaN;

      const isCancelled = cancelledSet.has(`${enrollmentId}-${i}`);
      let lessonStatus = "";
      if (isCancelled) {
        lessonStatus = "cancelled";
      } else if (Number.isFinite(scheduledMs) && scheduledMs < nowMs) {
        lessonStatus = "completed";
      }

      row[`lesson${i}DateTime`] = scheduledAt;
      row[`lesson${i}Instructor`] = readField(instructor ?? {}, "displayName", "displayname") ?? "";
      row[`lesson${i}Status`] = lessonStatus;
      row[`lesson${i}Ebook`] = readField(ebook ?? {}, "title") ?? "";
      row[`lesson${i}EbookUnlocked`] =
        Number.isFinite(scheduledMs) && scheduledMs + oneHourMs <= nowMs;
    }

    return row;
  });
}

function buildLessonRows(input: {
  courses: any[];
  courseEnrollments: any[];
  lessonSchedules: any[];
  contestSchedules: any[];
  users: any[];
  userProfiles: any[];
  lessonCancellations: any[];
}): Record<string, unknown>[] {
  const { courses, courseEnrollments, lessonSchedules, contestSchedules, users, userProfiles, lessonCancellations } = input;

  const contestByEnrollmentModule = new Map<string, string | null>();
  for (const row of contestSchedules ?? []) {
    const eid = row.enrollmentId ?? row.enrollment_id;
    const mn = row.moduleNumber ?? row.module_number;
    const sat = row.scheduledAt ?? row.scheduled_at ?? null;
    if (eid && mn) contestByEnrollmentModule.set(`${eid}-${mn}`, sat);
  }

  const cancelledSet = new Set<string>();
  for (const row of lessonCancellations ?? []) {
    const eid = readField<string | number>(row, "enrollmentId");
    const ln = readField<string | number>(row, "lessonNumber");
    if (eid && ln) cancelledSet.add(`${eid}-${ln}`);
  }

  const courseById = new Map(
    (courses ?? []).map((row: any) => [String(readField(row, "id")), row])
  );
  const userById = new Map(
    (users ?? []).map((row: any) => [String(readField(row, "id")), row])
  );
  const profileByUserId = new Map(
    (userProfiles ?? []).map((row: any) => [
      String(readField(row, "userId", "user_id")),
      row,
    ])
  );

  const scheduleByEnrollmentLesson = new Map<string, any>();
  for (const row of lessonSchedules ?? []) {
    const enrollmentId = readField<string | number>(row, "enrollmentId", "enrollment_id");
    const lessonNumber = Number(readField(row, "lessonNumber", "lesson_number") ?? 0);
    if (!enrollmentId || !lessonNumber) continue;
    scheduleByEnrollmentLesson.set(`${enrollmentId}-${lessonNumber}`, row);
  }

  const nowMs = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  const rows: Record<string, unknown>[] = [];

  const sortedEnrollments = [...(courseEnrollments ?? [])].sort(
    (a, b) => Number(readField(a, "id")) - Number(readField(b, "id"))
  );

  for (const enrollment of sortedEnrollments) {
    const enrollmentId = readField<string | number>(enrollment, "id");
    const userId = readField<string | number>(enrollment, "userId", "user_id");
    const courseId = readField<string | number>(enrollment, "courseId", "course_id");
    const course = courseById.get(String(courseId));
    const user = userById.get(String(userId));
    const profile = profileByUserId.get(String(userId));
    const instructorId = readField<string | number>(course ?? {}, "instructorId", "instructor_id");
    const instructor = instructorId ? userById.get(String(instructorId)) : null;

    const studentName =
      readField(profile ?? {}, "fullName", "full_name") ??
      readField(user ?? {}, "displayName", "displayname") ??
      readField(user ?? {}, "email") ?? "";
    const email = readField(user ?? {}, "email") ?? "";
    const courseName = readField(course ?? {}, "name") ?? "";
    const totalLessons = Number(readField(course ?? {}, "totalLessons", "total_lessons") ?? 0);
    const instructorName = readField(instructor ?? {}, "displayName", "displayname") ?? "";

    const boundaries = getModuleBoundaries(String(courseName ?? ""));

    for (let i = 1; i <= totalLessons; i++) {
      const schedule = scheduleByEnrollmentLesson.get(`${enrollmentId}-${i}`);
      const scheduledAt = readField<string | null>(schedule ?? {}, "scheduledAt", "scheduled_at") ?? null;
      const scheduledMs = scheduledAt ? new Date(scheduledAt).getTime() : NaN;
      const isCancelled = cancelledSet.has(`${enrollmentId}-${i}`);

      let status = "";
      if (isCancelled) {
        status = "cancelled";
      } else if (Number.isFinite(scheduledMs) && scheduledMs + oneHourMs <= nowMs) {
        status = "completed";
      }

      rows.push({
        enrollmentId,
        studentName,
        email,
        courseName,
        lessonNumber: i,
        scheduledAt: scheduledAt ?? null,
        instructor: instructorName,
        status,
      });

      // After this lesson, insert a contest row if it ends a module
      const moduleIndex = boundaries.indexOf(i);
      if (moduleIndex !== -1) {
        const moduleNumber = moduleIndex + 1;
        const contestAt = contestByEnrollmentModule.get(`${enrollmentId}-${moduleNumber}`) ?? null;
        const contestMs = contestAt ? new Date(contestAt).getTime() : NaN;
        rows.push({
          enrollmentId,
          studentName,
          email,
          courseName,
          lessonNumber: `Contest ${moduleNumber}`,
          scheduledAt: contestAt,
          instructor: instructorName,
          status: Number.isFinite(contestMs) && contestMs + oneHourMs <= nowMs ? "completed" : "",
        });
      }
    }
  }

  return rows;
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
      events,
      users,
      userProfiles,
      lessonCancellations,
      contestSchedulesResult,
    ] = await Promise.all([
      safeSelectCourses(),
      safeSelectEbooks(),
      safeSelectAll("rooms"),
      safeSelectAll("roomBookings"),
      safeSelectCourseEnrollments(),
      safeSelectAll("lessonCompletions"),
      safeSelectLessonSchedules(),
      safeSelectEvents(),
      safeSelectUsers(),
      safeSelectUserProfiles(),
      safeSelectAll("lessonCancellations"),
      supabaseAdmin.from("contestSchedules").select("enrollmentId, moduleNumber, scheduledAt"),
    ]);
    const contestSchedules = (contestSchedulesResult as any)?.data ?? [];

    const flattenedEnrollments = buildFlattenedEnrollments({
      courses,
      courseEnrollments,
      lessonSchedules,
      ebooks,
      users,
      userProfiles,
      lessonCancellations,
    });

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
      events,
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
          const totalLessons = Number(courseMap.get(String(courseId)) ?? 0);
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
      flattenedEnrollments,
      lessonRows: buildLessonRows({
        courses,
        courseEnrollments,
        lessonSchedules,
        contestSchedules,
        users,
        userProfiles,
        lessonCancellations,
      }),
      lessonCancellations: (lessonCancellations ?? []).sort(
        (a: any, b: any) => new Date(b.cancelledAt ?? 0).getTime() - new Date(a.cancelledAt ?? 0).getTime()
      ),
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
