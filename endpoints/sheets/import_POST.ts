import { validateSheetsApiKey } from "../../helpers/validateSheetsApiKey";
import { schema, OutputType } from "./import_POST.schema";
import superjson from "superjson";
import {
  sendPushNotification,
  cancelNotification,
} from "../../helpers/sendPushNotification";
import { supabaseAdmin } from "../../helpers/supabaseServer";

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

    if (table === "lessonSchedules") {
      processedCount = await handleLessonSchedulesImport(rows);
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
        message: error instanceof Error ? error.message : "Unknown error",
      } satisfies OutputType),
      { status: 500 }
    );
  }
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

    if (row.id) {
      const { data, error } = await supabaseAdmin
        .from("lessonSchedules")
        .select("*")
        .eq("id", row.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      existingSchedule = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("lessonSchedules")
        .select("*")
        .eq("enrollmentId", row.enrollmentId)
        .eq("lessonNumber", row.lessonNumber)
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      existingSchedule = data;
    }

    const timeChanged = existingSchedule
      ? new Date(existingSchedule.scheduledAt).getTime() !== scheduledDate.getTime()
      : true;

    const scheduleData: Record<string, any> = {
      enrollmentId: row.enrollmentId,
      lessonNumber: row.lessonNumber,
      scheduledAt: scheduledDate.toISOString(),
      notification1hId: existingSchedule?.notification1hId ?? null,
      notification24hId: existingSchedule?.notification24hId ?? null,
    };

    if (timeChanged && existingSchedule) {
      if (existingSchedule.notification1hId) {
        await cancelNotification(existingSchedule.notification1hId);
        scheduleData.notification1hId = null;
      }
      if (existingSchedule.notification24hId) {
        await cancelNotification(existingSchedule.notification24hId);
        scheduleData.notification24hId = null;
      }
    }

    if (timeChanged) {
      const { data: enrollment, error: enrollmentErr } = await supabaseAdmin
        .from("courseEnrollments")
        .select("userId")
        .eq("id", row.enrollmentId)
        .limit(1)
        .maybeSingle();
      if (enrollmentErr && enrollmentErr.code !== "PGRST116") throw enrollmentErr;

      if (enrollment?.userId) {
        const userId = String(enrollment.userId);
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
          if (id24h) scheduleData.notification24hId = id24h;
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
          if (id1h) scheduleData.notification1hId = id1h;
        }
      }
    }

    if (existingSchedule?.id) {
      const { error } = await supabaseAdmin
        .from("lessonSchedules")
        .update(scheduleData)
        .eq("id", existingSchedule.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("lessonSchedules").insert(scheduleData);
      if (error) throw error;
    }

    count++;
  }

  return count;
}

