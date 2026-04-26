import { validateSheetsApiKey } from "../../helpers/validateSheetsApiKey";
import { schema, OutputType } from "./import_POST.schema";
import superjson from "superjson";
import {
  sendPushNotification,
  cancelNotification,
} from "../../helpers/sendPushNotification";
import { supabaseAdmin } from "../../helpers/supabaseServer";

const MAX_LESSONS = 33;

const TABLE_COLUMNS: Record<string, Set<string>> = {
  courses: new Set([
    "id",
    "name",
    "description",
    "totalLessons",
    "maxStudents",
    "skillLevel",
    "price",
    "isActive",
    "instructorId",
  ]),
  ebooks: new Set([
    "id",
    "title",
    "titleVi",
    "description",
    "descriptionVi",
    "coverImageUrl",
    "fileUrl",
    "courseId",
    "sortOrder",
    "isActive",
  ]),
  rooms: new Set([
    "id",
    "name",
    "description",
    "roomType",
    "capacity",
    "equipment",
    "isActive",
    "hourlyRate",
  ]),
  roomBookings: new Set([
    "id",
    "userId",
    "roomId",
    "startTime",
    "endTime",
    "status",
    "notes",
  ]),
  courseEnrollments: new Set([
    "id",
    "userId",
    "courseId",
    "status",
    "progressPercentage",
    "enrolledAt",
    "completedAt",
  ]),
  lessonCompletions: new Set([
    "id",
    "enrollmentId",
    "lessonNumber",
    "markedBy",
    "completedAt",
  ]),
  lessonSchedules: new Set([
    "id",
    "enrollmentId",
    "lessonNumber",
    "scheduledAt",
    "notification1hId",
    "notification24hId",
  ]),
  events: new Set([
    "id",
    "title",
    "caption",
    "flyerUrl",
    "startAt",
    "endAt",
    "isActive",
    "notification1hId",
    "notification24hId",
  ]),
  users: new Set([
    "id",
    "email",
    "displayName",
    "avatarUrl",
    "role",
    "whatsappNumber",
  ]),
  userProfiles: new Set([
    "id",
    "userId",
    "fullName",
    "gender",
    "address",
    "phoneNumber",
    "dateOfBirth",
    "preferredPaymentMethod",
    "bankAccountName",
    "bankAccountNumber",
    "bankName",
    "registrationCompleted",
  ]),
};

function pickAllowed(table: string, row: Record<string, any>) {
  const allowed = TABLE_COLUMNS[table];
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (allowed?.has(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function normalizeLessonScheduleRow(row: Record<string, any>) {
  return {
    id: row.id ?? null,
    enrollmentId: row.enrollmentId ?? row.enrollment_id ?? null,
    lessonNumber: row.lessonNumber ?? row.lesson_number ?? null,
    scheduledAt: row.scheduledAt ?? row.scheduled_at ?? null,
    notification1hId: row.notification1hId ?? row.notification_1h_id ?? null,
    notification24hId: row.notification24hId ?? row.notification_24h_id ?? null,
  };
}

function normalizeEventRow(row: Record<string, any>) {
  const isActiveRaw = row.isActive ?? row.is_active;
  const isActive =
    typeof isActiveRaw === "string"
      ? isActiveRaw.toLowerCase() === "true"
      : isActiveRaw ?? true;

  return {
    id: row.id ?? null,
    title: row.title ?? null,
    caption: row.caption ?? null,
    flyerUrl: row.flyerUrl ?? row.flyer_url ?? null,
    startAt: row.startAt ?? row.start_at ?? null,
    endAt: row.endAt ?? row.end_at ?? null,
    isActive,
    notification1hId: row.notification1hId ?? row.notification_1h_id ?? null,
    notification24hId: row.notification24hId ?? row.notification_24h_id ?? null,
  };
}

function getFromRow(row: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

function parseLessonNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(1, Math.floor(parsed));
    const match = value.match(/(\d+)/);
    if (match) return Math.max(1, Number(match[1]));
  }
  return fallback;
}

// Vietnam timezone offset: UTC+7
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseDateAsVietnam(
  year: number, month: number, day: number,
  hour: number, minute: number, second = 0
): string {
  // Convert Vietnam local time → UTC by subtracting VN offset
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - VN_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

function normalizeDateToIso(value: unknown): string | null {
  if (!value) return null;
  const raw = value as any;

  if (typeof raw === "string") {
    const str = raw.trim();
    const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(str);

    if (!hasTimezone) {
      // Vietnamese format: d/M/yyyy h:mm am/pm  (e.g. "17/4/2026 2:00 pm")
      // or with 24h time:  d/M/yyyy H:mm         (e.g. "17/4/2026 14:00")
      const vnMatch = str.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i
      );
      if (vnMatch) {
        const [, d, m, y, hr, min, sec, ampm] = vnMatch;
        let hour = parseInt(hr, 10);
        if (ampm) {
          if (ampm.toLowerCase() === "pm" && hour < 12) hour += 12;
          if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
        }
        return parseDateAsVietnam(
          parseInt(y, 10), parseInt(m, 10), parseInt(d, 10),
          hour, parseInt(min, 10), sec ? parseInt(sec, 10) : 0
        );
      }

      // ISO-like without timezone: "2026-03-20 10:00" or "2026-03-20T10:00"
      const local = new Date(str);
      if (Number.isNaN(local.getTime())) return null;
      // Server is UTC, so getTimezoneOffset() === 0; just subtract VN offset
      const serverOffsetMs = local.getTimezoneOffset() * 60 * 1000;
      return new Date(local.getTime() + serverOffsetMs - VN_OFFSET_MS).toISOString();
    }
  }

  // Google Sheets serial numbers — treat as VN midnight
  if (typeof raw === "number") {
    const MS_PER_DAY = 86400000;
    const SHEETS_EPOCH_OFFSET = 25569;
    const utcMs = (raw - SHEETS_EPOCH_OFFSET) * MS_PER_DAY - VN_OFFSET_MS;
    const date = new Date(utcMs);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isSchemaError(error: any): boolean {
  const message = String(error?.message ?? "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42P01" ||
    message.includes("relation") ||
    message.includes("schema cache")
  );
}

function isForeignKeyError(error: any): boolean {
  return error?.code === "23503";
}

function isMissingEventNotificationColumnError(error: any): boolean {
  const message = String(error?.message ?? "");
  if (error?.code !== "PGRST204") return false;
  return (
    message.includes("notification1hId") ||
    message.includes("notification24hId") ||
    message.includes("notification_1h_id") ||
    message.includes("notification_24h_id")
  );
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e: any = error;
    const message = e.message ?? "Unknown error";
    const code = e.code ? ` [${e.code}]` : "";
    const details = e.details ? ` details=${e.details}` : "";
    const hint = e.hint ? ` hint=${e.hint}` : "";
    return `${message}${code}${details}${hint}`;
  }
  return String(error ?? "Unknown error");
}

export async function handle(request: Request) {
  try {
    const validation = validateSheetsApiKey(request);
    if (!validation.valid) {
      return validation.response;
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    const { table, rows } = input;

    if (rows.length === 0) {
      return new Response(
        superjson.stringify({
          success: true,
          count: 0,
          message: "No rows to import",
        } satisfies OutputType)
      );
    }

    let processedCount = 0;

    if (table === "flattenedEnrollments") {
      processedCount = await handleFlattenedEnrollmentsImport(rows);
    } else if (table === "lessonRows") {
      processedCount = await handleLessonRowsImport(rows);
    } else if (table === "lessonSchedules") {
      processedCount = await handleLessonSchedulesImport(rows);
    } else if (table === "events") {
      processedCount = await handleEventsImport(rows);
    } else {
      for (const rawRow of rows) {
        const row = pickAllowed(table, rawRow as Record<string, any>);
        if (!Object.keys(row).length) continue;

        if (!row.id) {
          delete row.id;
          const { error } = await supabaseAdmin.from(table).insert(row);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from(table)
            .upsert(row, { onConflict: "id" });
          if (error) throw error;
        }
        processedCount++;
      }
    }

    return new Response(
      superjson.stringify({
        success: true,
        count: processedCount,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error importing sheets data:", error);
    return new Response(
      superjson.stringify({
        success: false,
        count: 0,
        message: formatUnknownError(error),
      } satisfies OutputType),
      { status: 500 }
    );
  }
}

async function handleFlattenedEnrollmentsImport(rows: any[]) {
  const { data: users, error: usersError } = await supabaseAdmin
    .from("users")
    .select("id,email");
  if (usersError) throw usersError;

  const { data: courses, error: coursesError } = await supabaseAdmin
    .from("courses")
    .select("id,name");
  if (coursesError) throw coursesError;

  const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
    .from("courseEnrollments")
    .select("id,userId,courseId,status,progressPercentage,enrolledAt,completedAt");
  if (enrollmentsError) throw enrollmentsError;

  const userIdByEmail = new Map(
    (users ?? []).map((u: any) => [String(u.email ?? "").toLowerCase().trim(), u.id])
  );
  const courseIdByName = new Map(
    (courses ?? []).map((c: any) => [String(c.name ?? "").toLowerCase().trim(), c.id])
  );
  const enrollmentByKey = new Map(
    (enrollments ?? []).map((e: any) => [`${e.userId}-${e.courseId}`, e])
  );
  // Also index by id so we can match the exact enrollment the sheet row came from.
  const enrollmentById = new Map(
    (enrollments ?? []).map((e: any) => [String(e.id), e])
  );

  const scheduleRows: Array<Record<string, any>> = [];
  const lessonsToDelete: Array<{
    enrollmentId: string | number;
    lessonNumber: number;
  }> = [];
  let processedEnrollments = 0;

  for (const rawRow of rows as Array<Record<string, any>>) {
    const row = rawRow ?? {};
    const emailRaw = getFromRow(row, ["email", "studentEmail", "userEmail", "Email"]);
    const email = String(emailRaw ?? "").toLowerCase().trim();
    if (!email) continue;

    const userId = userIdByEmail.get(email);
    if (!userId) continue;

    const courseIdRaw = getFromRow(row, ["courseId", "Course ID"]);
    let courseId =
      courseIdRaw !== null && courseIdRaw !== undefined && courseIdRaw !== ""
        ? Number(courseIdRaw)
        : null;

    if (!courseId || Number.isNaN(courseId)) {
      const courseNameRaw = getFromRow(row, ["courseName", "Course"]);
      const courseName = String(courseNameRaw ?? "").toLowerCase().trim();
      if (!courseName) continue;
      courseId = courseIdByName.get(courseName) ?? null;
    }
    if (!courseId) continue;

    // Prefer the enrollmentId from the sheet row — this is the enrollment the user
    // was editing. Fall back to userId+courseId lookup only if not found in DB.
    const sheetEnrollmentId = getFromRow(row, ["enrollmentId"]);
    let enrollment = sheetEnrollmentId ? enrollmentById.get(String(sheetEnrollmentId)) : undefined;
    if (!enrollment) {
      const enrollmentKey = `${userId}-${courseId}`;
      enrollment = enrollmentByKey.get(enrollmentKey);
    }
    if (!enrollment) {
      const insertPayload = {
        userId,
        courseId,
        status: "active",
        progressPercentage: 0,
        enrolledAt: new Date().toISOString(),
        completedAt: null,
      };
      const { data, error } = await supabaseAdmin
        .from("courseEnrollments")
        .insert(insertPayload)
        .select("id,userId,courseId,status,progressPercentage,enrolledAt,completedAt")
        .single();
      if (error) throw error;
      enrollment = data;
      enrollmentByKey.set(enrollmentKey, enrollment);
    }
    if (!enrollment?.id) continue;
    processedEnrollments++;

    for (let i = 1; i <= MAX_LESSONS; i++) {
      const lessonKeys = [
        `lesson${i}DateTime`,
        `Lesson ${i} Date/Time`,
        `lesson${i}At`,
      ];
      const hasLessonColumn = lessonKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(row, key)
      );
      const dtValue = getFromRow(row, lessonKeys);
      const scheduledAt = normalizeDateToIso(dtValue);

      if (scheduledAt) {
        scheduleRows.push({
          enrollmentId: enrollment.id,
          lessonNumber: i,
          scheduledAt,
        });
        continue;
      }

      // Only treat explicit blanks as deletions.
      // Invalid/non-empty values should not remove an existing schedule.
      if (hasLessonColumn && (dtValue === null || dtValue === undefined || dtValue === "")) {
        lessonsToDelete.push({
          enrollmentId: enrollment.id,
          lessonNumber: i,
        });
      }
    }
  }

  const deleteCount = await handleLessonSchedulesDelete(lessonsToDelete);
  const scheduleCount = await handleLessonSchedulesImport(scheduleRows);
  return processedEnrollments + scheduleCount + deleteCount;
}

// Handles the new row-per-lesson sheet format.
// Each row has: enrollmentId, lessonNumber, scheduledAt (ISO string or null).
// Rows where lessonNumber is "Contest N" are routed to contestSchedules.
// Non-null scheduledAt → upsert. Null scheduledAt → delete.
async function handleLessonRowsImport(rows: any[]) {
  const scheduleRows: Array<Record<string, any>> = [];
  const deleteRows: Array<{ enrollmentId: string | number; lessonNumber: number }> = [];
  const contestUpsertRows: Array<{ enrollmentId: string | number; moduleNumber: number; scheduledAt: string }> = [];
  const contestDeleteRows: Array<{ enrollmentId: string | number; moduleNumber: number }> = [];

  for (const raw of rows as Array<Record<string, any>>) {
    const enrollmentId = raw.enrollmentId ?? null;
    if (!enrollmentId) continue;

    const lessonRaw = String(raw.lessonNumber ?? "");
    const contestMatch = lessonRaw.match(/^Contest\s*(\d+)$/i);
    if (contestMatch) {
      const moduleNumber = Number(contestMatch[1]);
      const scheduledAt = raw.scheduledAt ?? null;
      if (scheduledAt && moduleNumber) {
        contestUpsertRows.push({ enrollmentId, moduleNumber, scheduledAt });
      } else if (moduleNumber) {
        contestDeleteRows.push({ enrollmentId, moduleNumber });
      }
      continue;
    }

    const lessonNumber = Number(raw.lessonNumber ?? 0);
    if (!lessonNumber) continue;

    const scheduledAt = raw.scheduledAt ?? null;
    if (scheduledAt) {
      scheduleRows.push({ enrollmentId, lessonNumber, scheduledAt });
    } else {
      deleteRows.push({ enrollmentId, lessonNumber });
    }
  }

  // Upsert contest schedules
  for (const row of contestUpsertRows) {
    await supabaseAdmin
      .from("contestSchedules")
      .upsert({ enrollmentId: row.enrollmentId, moduleNumber: row.moduleNumber, scheduledAt: row.scheduledAt }, { onConflict: "enrollmentId,moduleNumber" });
  }
  // Delete blanked-out contest schedules
  for (const row of contestDeleteRows) {
    await supabaseAdmin
      .from("contestSchedules")
      .delete()
      .eq("enrollmentId", row.enrollmentId as any)
      .eq("moduleNumber", row.moduleNumber as any);
  }

  const deleteCount = await handleLessonSchedulesDelete(deleteRows);
  const scheduleCount = await handleLessonSchedulesImport(scheduleRows);
  return scheduleCount + deleteCount + contestUpsertRows.length + contestDeleteRows.length;
}

async function handleLessonSchedulesDelete(
  rows: Array<{ enrollmentId: string | number; lessonNumber: number }>
) {
  let count = 0;
  if (!rows.length) return count;

  for (const row of rows) {
    let scheduleTable = "lessonSchedules";
    let existing: any = null;

    let { data, error } = await supabaseAdmin
      .from("lessonSchedules")
      .select("*")
      .eq("enrollmentId", row.enrollmentId)
      .eq("lessonNumber", row.lessonNumber)
      .limit(1)
      .maybeSingle();

    if (error && isSchemaError(error)) {
      scheduleTable = "lesson_schedules";
      ({ data, error } = await supabaseAdmin
        .from("lesson_schedules")
        .select("*")
        .eq("enrollment_id", row.enrollmentId)
        .eq("lesson_number", row.lessonNumber)
        .limit(1)
        .maybeSingle());
    }

    if (error && error.code !== "PGRST116") throw error;
    existing = data;
    if (!existing?.id) continue;

    const old1h = existing.notification1hId ?? existing.notification_1h_id;
    const old24h = existing.notification24hId ?? existing.notification_24h_id;

    if (old1h) await cancelNotification(old1h);
    if (old24h) await cancelNotification(old24h);

    const { error: deleteError } = await supabaseAdmin
      .from(scheduleTable)
      .delete()
      .eq("id", existing.id);
    if (deleteError) throw deleteError;

    count++;
  }

  return count;
}

async function handleLessonSchedulesImport(rows: any[]) {
  let count = 0;

  for (const raw of rows) {
    const row = normalizeLessonScheduleRow(raw);
    if (!row.enrollmentId || !row.lessonNumber || !row.scheduledAt) {
      continue;
    }

    const scheduledDate = new Date(row.scheduledAt);
    let existingSchedule: any = null;
    let scheduleTable = "lessonSchedules";

    const fetchExistingById = async (table: string) => {
      return supabaseAdmin.from(table).select("*").eq("id", row.id).limit(1).maybeSingle();
    };
    const fetchExistingByKey = async (table: string) => {
      if (table === "lessonSchedules") {
        return supabaseAdmin
          .from(table)
          .select("*")
          .eq("enrollmentId", row.enrollmentId)
          .eq("lessonNumber", row.lessonNumber)
          .limit(1)
          .maybeSingle();
      }
      return supabaseAdmin
        .from(table)
        .select("*")
        .eq("enrollment_id", row.enrollmentId)
        .eq("lesson_number", row.lessonNumber)
        .limit(1)
        .maybeSingle();
    };

    if (row.id) {
      let { data, error } = await fetchExistingById("lessonSchedules");
      if (error && isSchemaError(error)) {
        scheduleTable = "lesson_schedules";
        ({ data, error } = await fetchExistingById("lesson_schedules"));
      }
      if (error && error.code !== "PGRST116") throw error;
      existingSchedule = data;
    } else {
      let { data, error } = await fetchExistingByKey("lessonSchedules");
      if (error && isSchemaError(error)) {
        scheduleTable = "lesson_schedules";
        ({ data, error } = await fetchExistingByKey("lesson_schedules"));
      }
      if (error && error.code !== "PGRST116") throw error;
      existingSchedule = data;
    }

    const timeChanged = existingSchedule
      ? new Date(existingSchedule.scheduledAt ?? existingSchedule.scheduled_at).getTime() !== scheduledDate.getTime()
      : true;

    const scheduleData: Record<string, any> = {
      ...(scheduleTable === "lessonSchedules"
        ? {
            enrollmentId: row.enrollmentId,
            lessonNumber: row.lessonNumber,
            scheduledAt: scheduledDate.toISOString(),
            notification1hId:
              existingSchedule?.notification1hId ??
              existingSchedule?.notification_1h_id ??
              null,
            notification24hId:
              existingSchedule?.notification24hId ??
              existingSchedule?.notification_24h_id ??
              null,
          }
        : {
            enrollment_id: row.enrollmentId,
            lesson_number: row.lessonNumber,
            scheduled_at: scheduledDate.toISOString(),
            notification_1h_id:
              existingSchedule?.notification_1h_id ??
              existingSchedule?.notification1hId ??
              null,
            notification_24h_id:
              existingSchedule?.notification_24h_id ??
              existingSchedule?.notification24hId ??
              null,
          }),
    };

    if (timeChanged && existingSchedule) {
      const old1h =
        existingSchedule.notification1hId ?? existingSchedule.notification_1h_id;
      const old24h =
        existingSchedule.notification24hId ?? existingSchedule.notification_24h_id;

      if (old1h) {
        await cancelNotification(old1h);
        if (scheduleTable === "lessonSchedules") scheduleData.notification1hId = null;
        else scheduleData.notification_1h_id = null;
      }
      if (old24h) {
        await cancelNotification(old24h);
        if (scheduleTable === "lessonSchedules") scheduleData.notification24hId = null;
        else scheduleData.notification_24h_id = null;
      }
    }

    if (timeChanged) {
      let { data: enrollment, error: enrollmentErr } = await supabaseAdmin
        .from("courseEnrollments")
        .select("userId, courseId")
        .eq("id", row.enrollmentId)
        .limit(1)
        .maybeSingle();
      if (enrollmentErr && isSchemaError(enrollmentErr)) {
        ({ data: enrollment, error: enrollmentErr } = await supabaseAdmin
          .from("course_enrollments")
          .select("user_id, course_id")
          .eq("id", row.enrollmentId)
          .limit(1)
          .maybeSingle());
      }
      if (enrollmentErr && enrollmentErr.code !== "PGRST116") throw enrollmentErr;

      const enrollmentUserId = enrollment?.userId ?? enrollment?.user_id;
      const enrollmentCourseId = enrollment?.courseId ?? enrollment?.course_id;

      // Notify the instructor immediately (no send_after) when a lesson is scheduled
      if (enrollmentCourseId) {
        try {
          const { data: course } = await supabaseAdmin
            .from("courses")
            .select("instructorId, name")
            .eq("id", enrollmentCourseId)
            .limit(1)
            .maybeSingle();

          if (course?.instructorId) {
            const { data: student } = await supabaseAdmin
              .from("users")
              .select("displayName")
              .eq("id", enrollmentUserId)
              .limit(1)
              .maybeSingle();

            const studentLabel = student?.displayName ?? "A student";
            const lessonLabel = `Lesson ${row.lessonNumber}`;
            const timeStr = scheduledDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            await sendPushNotification({
              headings: { en: "New Lesson Scheduled", vi: "Lịch học mới được đặt" },
              contents: {
                en: `${studentLabel} — ${course.name} ${lessonLabel} on ${timeStr}`,
                vi: `${studentLabel} — ${course.name} ${lessonLabel} vào ${scheduledDate.toLocaleDateString("vi-VN")}`,
              },
              includeExternalUserIds: [String(course.instructorId)],
              // No send_after → delivers immediately
            });
          }
        } catch {
          // Non-fatal: if instructor notification fails, don't block the import
        }
      }

      if (enrollmentUserId) {
        const userId = String(enrollmentUserId);
        const now = new Date();

        const time24h = new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000);
        if (time24h > now) {
          const id24h = await sendPushNotification({
            headings: { en: "Class Tomorrow!", vi: "Lớp học ngày mai!" },
            contents: {
              en: `You have a class scheduled tomorrow at ${scheduledDate.toLocaleTimeString(
                "en-US",
                { hour: "2-digit", minute: "2-digit", hour12: false }
              )}`,
              vi: `Bạn có lớp học vào ngày mai lúc ${scheduledDate.toLocaleTimeString(
                "vi-VN",
                { hour: "2-digit", minute: "2-digit", hour12: false }
              )}`,
            },
            includeExternalUserIds: [userId],
            send_after: time24h,
          });
          if (id24h) {
            if (scheduleTable === "lessonSchedules") scheduleData.notification24hId = id24h;
            else scheduleData.notification_24h_id = id24h;
          }
        }

        const time1h = new Date(scheduledDate.getTime() - 60 * 60 * 1000);
        if (time1h > now) {
          const id1h = await sendPushNotification({
            headings: { en: "Class in 1 Hour!", vi: "Lớp học trong 1 giờ nữa!" },
            contents: {
              en: "Your class starts in 1 hour!",
              vi: "Lớp học của bạn bắt đầu trong 1 giờ nữa!",
            },
            includeExternalUserIds: [userId],
            send_after: time1h,
          });
          if (id1h) {
            if (scheduleTable === "lessonSchedules") scheduleData.notification1hId = id1h;
            else scheduleData.notification_1h_id = id1h;
          }
        }
      }
    }

    if (existingSchedule?.id) {
      const { error } = await supabaseAdmin
        .from(scheduleTable)
        .update(scheduleData)
        .eq("id", existingSchedule.id);
      if (error) throw error;
    } else {
      let { error } = await supabaseAdmin.from(scheduleTable).insert(scheduleData);
      if (error && isForeignKeyError(error) && scheduleTable === "lessonSchedules") {
        // enrollmentId belongs to course_enrollments, not courseEnrollments — use snake_case table
        const snakeData = {
          enrollment_id: row.enrollmentId,
          lesson_number: row.lessonNumber,
          scheduled_at: scheduledDate.toISOString(),
          notification_1h_id: scheduleData.notification1hId ?? null,
          notification_24h_id: scheduleData.notification24hId ?? null,
        };
        ({ error } = await supabaseAdmin.from("lesson_schedules").insert(snakeData));
      }
      if (error) throw error;
    }

    count++;
  }

  return count;
}

async function handleEventsImport(rows: any[]) {
  let count = 0;

  for (const raw of rows) {
    const row = normalizeEventRow(raw ?? {});
    if (!row.title || !row.startAt) continue;

    const startDate = new Date(row.startAt);
    if (Number.isNaN(startDate.getTime())) continue;
    const endDate = row.endAt ? new Date(row.endAt) : null;
    if (endDate && Number.isNaN(endDate.getTime())) continue;

    let existingEvent: any = null;
    if (row.id) {
      const { data, error } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("id", row.id)
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      existingEvent = data;
    }

    const existingStart = existingEvent?.startAt
      ? new Date(existingEvent.startAt).getTime()
      : null;
    const timeChanged = existingStart == null || existingStart !== startDate.getTime();

    const eventData: Record<string, any> = {
      title: row.title,
      caption: row.caption ?? null,
      flyerUrl: row.flyerUrl ?? null,
      startAt: startDate.toISOString(),
      endAt: endDate ? endDate.toISOString() : null,
      isActive: row.isActive !== false,
      notification1hId:
        existingEvent?.notification1hId ?? row.notification1hId ?? null,
      notification24hId:
        existingEvent?.notification24hId ?? row.notification24hId ?? null,
    };

    const shouldResetNotifications = timeChanged || eventData.isActive === false;
    if (shouldResetNotifications) {
      const old1h = existingEvent?.notification1hId;
      const old24h = existingEvent?.notification24hId;
      if (old1h) await cancelNotification(old1h);
      if (old24h) await cancelNotification(old24h);
      eventData.notification1hId = null;
      eventData.notification24hId = null;
    }

    if (eventData.isActive && timeChanged) {
      const now = new Date();
      const time24h = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      const time1h = new Date(startDate.getTime() - 60 * 60 * 1000);

      if (time24h > now) {
        const id24h = await sendPushNotification({
          headings: { en: "Event Tomorrow!", vi: "Sự kiện ngày mai!" },
          contents: {
            en: `${row.title} starts tomorrow at ${startDate.toLocaleTimeString(
              "en-US",
              { hour: "2-digit", minute: "2-digit", hour12: false }
            )}`,
            vi: `${row.title} bắt đầu vào ngày mai lúc ${startDate.toLocaleTimeString(
              "vi-VN",
              { hour: "2-digit", minute: "2-digit", hour12: false }
            )}`,
          },
          segments: ["All"],
          send_after: time24h,
        });
        if (id24h) eventData.notification24hId = id24h;
      }

      if (time1h > now) {
        const id1h = await sendPushNotification({
          headings: { en: "Event in 1 Hour!", vi: "Sự kiện trong 1 giờ nữa!" },
          contents: {
            en: `${row.title} starts in 1 hour.`,
            vi: `${row.title} sẽ bắt đầu trong 1 giờ nữa.`,
          },
          segments: ["All"],
          send_after: time1h,
        });
        if (id1h) eventData.notification1hId = id1h;
      }
    }

    if (existingEvent?.id) {
      let { error } = await supabaseAdmin
        .from("events")
        .update(eventData)
        .eq("id", existingEvent.id);
      if (error && isMissingEventNotificationColumnError(error)) {
        const { notification1hId, notification24hId, ...fallbackData } = eventData;
        ({ error } = await supabaseAdmin
          .from("events")
          .update(fallbackData)
          .eq("id", existingEvent.id));
      }
      if (error) throw error;
    } else {
      const insertData = row.id ? { ...eventData, id: row.id } : eventData;
      let { error } = await supabaseAdmin.from("events").insert(insertData);
      if (error && isMissingEventNotificationColumnError(error)) {
        const { notification1hId, notification24hId, ...fallbackData } = insertData;
        ({ error } = await supabaseAdmin.from("events").insert(fallbackData));
      }
      if (error) throw error;
    }

    count++;
  }

  return count;
}
