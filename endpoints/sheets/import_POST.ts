import { db } from "../../helpers/db";
import { validateSheetsApiKey } from "../../helpers/validateSheetsApiKey";
import { schema, OutputType } from "./import_POST.schema";
import superjson from "superjson";
import {
  sendPushNotification,
  cancelNotification,
} from "../../helpers/sendPushNotification";

export async function handle(request: Request) {
  try {
    const validation = validateSheetsApiKey(request);
    if (!validation.valid) {
      return validation.response;
    }

    // Do not use request.json(), use superjson parsing
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

    // Handle generic upserts for most tables, specific logic for lessonSchedules
    if (table === "lessonSchedules") {
      processedCount = await handleLessonSchedulesImport(rows);
    } else {
      // For other tables, we perform a standard upsert.
      // We loop and upsert one by one for safety and flexibility with dynamic table names.
      for (const row of rows) {
        // Remove null ID if it exists (let DB generate it) or keep it if it's an update
        if (!row.id) {
          delete row.id;
        }

        const rowAny = row as any;

        // If ID exists, try to update, otherwise insert
        if (row.id) {
          const existing = await db
            .selectFrom(table as any)
            .selectAll()
            .where("id", "=", row.id)
            .executeTakeFirst();

          if (existing) {
            await db
              .updateTable(table as any)
              .set(rowAny)
              .where("id", "=", row.id)
              .execute();
          } else {
            await db.insertInto(table as any).values(rowAny).execute();
          }
        } else {
          await db.insertInto(table as any).values(rowAny).execute();
        }
      }
      processedCount = rows.length;
    }

    return new Response(
      superjson.stringify({
        success: true,
        count: processedCount,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error importing sheets data:", error);
    // Return error message
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

  for (const row of rows) {
    const {
      enrollmentId,
      lessonNumber,
      scheduledAt,
      id, // Might be present if updating
      notification1hId,
      notification24hId,
      ...otherFields
    } = row;

    if (!enrollmentId || !lessonNumber || !scheduledAt) {
      console.warn("Skipping invalid lesson schedule row", row);
      continue;
    }

    const scheduledDate = new Date(scheduledAt);

    // 1. Check for existing schedule
    let existingSchedule;
    if (id) {
      existingSchedule = await db
        .selectFrom("lessonSchedules")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
    } else {
      // Fallback: try to find by enrollmentId + lessonNumber
      existingSchedule = await db
        .selectFrom("lessonSchedules")
        .selectAll()
        .where("enrollmentId", "=", enrollmentId)
        .where("lessonNumber", "=", lessonNumber)
        .executeTakeFirst();
    }

    // Determine if we need to reschedule notifications
    // Reschedule if:
    // - It's a new record
    // - The scheduled time has changed
    // - (Optional) The user manually cleared notification IDs in sheet to force resend (handled if IDs are missing in DB but logic here depends on `existingSchedule`)
    const timeChanged = existingSchedule
      ? new Date(existingSchedule.scheduledAt).getTime() !==
        scheduledDate.getTime()
      : true;

    // Prepare the record data
    const scheduleData = {
      enrollmentId,
      lessonNumber,
      scheduledAt: scheduledDate,
      ...otherFields,
      // We will set notification IDs later if we schedule them
      notification1hId: existingSchedule?.notification1hId ?? null,
      notification24hId: existingSchedule?.notification24hId ?? null,
    };

    // If time changed, cancel old notifications
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

    // Schedule new notifications if needed
    if (timeChanged) {
      // Need userId to target notification
      const enrollment = await db
        .selectFrom("courseEnrollments")
        .select("userId")
        .where("id", "=", enrollmentId)
        .executeTakeFirst();

      if (enrollment) {
        const userId = String(enrollment.userId);
        const now = new Date();

        // 24h Notification
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
            scheduleData.notification24hId = id24h;
          }
        }

        // 1h Notification
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
            scheduleData.notification1hId = id1h;
          }
        }
      }
    } else {
        // If time didn't change, preserve existing notification IDs (already set in initial object)
        // unless passed explicitly in row which we are ignoring for now to let system manage it.
    }

    // Upsert the schedule
    if (existingSchedule) {
      await db
        .updateTable("lessonSchedules")
        .set(scheduleData)
        .where("id", "=", existingSchedule.id)
        .execute();
    } else {
      await db.insertInto("lessonSchedules").values(scheduleData).execute();
    }
    count++;
  }

  return count;
}