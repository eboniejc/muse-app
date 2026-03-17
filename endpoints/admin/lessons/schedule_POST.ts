import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./schedule_POST.schema";
import {
  sendPushNotification,
  cancelNotification,
} from "../../../helpers/sendPushNotification";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Fetch enrollment to get the student's userId and course name
    const enrollment = await db
      .selectFrom("courseEnrollments")
      .innerJoin("courses", "courseEnrollments.courseId", "courses.id")
      .select(["courseEnrollments.userId", "courses.name as courseName"])
      .where("courseEnrollments.id", "=", input.enrollmentId)
      .executeTakeFirst();

    if (!enrollment) {
      return new Response(
        superjson.stringify({ error: "Enrollment not found" }),
        { status: 404 }
      );
    }

    // Check for an existing schedule to cancel old notifications
    const existing = await db
      .selectFrom("lessonSchedules")
      .select(["id", "notification1hId", "notification24hId"])
      .where("enrollmentId", "=", input.enrollmentId)
      .where("lessonNumber", "=", input.lessonNumber)
      .executeTakeFirst();

    if (existing) {
      if (existing.notification24hId) {
        await cancelNotification(existing.notification24hId).catch(() => null);
      }
      if (existing.notification1hId) {
        await cancelNotification(existing.notification1hId).catch(() => null);
      }
    }

    const scheduledAt = new Date(input.scheduledAt);
    const now = new Date();
    const notify24hAt = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    const notify1hAt = new Date(scheduledAt.getTime() - 60 * 60 * 1000);

    const userIdStr = String(enrollment.userId);
    const lessonLabel = `Lesson ${input.lessonNumber}`;

    // Schedule 24h-before notification if that time is still in the future
    let notification24hId: string | null = null;
    if (notify24hAt > now) {
      notification24hId = await sendPushNotification({
        headings: {
          en: "Class Tomorrow",
          vi: "Lớp học vào ngày mai",
        },
        contents: {
          en: `Reminder: ${enrollment.courseName} — ${lessonLabel} is scheduled for tomorrow.`,
          vi: `Nhắc nhở: ${enrollment.courseName} — ${lessonLabel} được lên lịch vào ngày mai.`,
        },
        includeExternalUserIds: [userIdStr],
        send_after: notify24hAt,
        data: { enrollmentId: input.enrollmentId, lessonNumber: input.lessonNumber },
      });
    }

    // Schedule 1h-before notification if that time is still in the future
    let notification1hId: string | null = null;
    if (notify1hAt > now) {
      notification1hId = await sendPushNotification({
        headings: {
          en: "Class in 1 Hour",
          vi: "Lớp học sau 1 giờ",
        },
        contents: {
          en: `${enrollment.courseName} — ${lessonLabel} starts in 1 hour. Get ready!`,
          vi: `${enrollment.courseName} — ${lessonLabel} bắt đầu sau 1 giờ. Chuẩn bị nào!`,
        },
        includeExternalUserIds: [userIdStr],
        send_after: notify1hAt,
        data: { enrollmentId: input.enrollmentId, lessonNumber: input.lessonNumber },
      });
    }

    // Upsert the lesson schedule row
    let scheduleId: number;
    if (existing) {
      await db
        .updateTable("lessonSchedules")
        .set({
          scheduledAt,
          notification24hId,
          notification1hId,
          updatedAt: new Date(),
        })
        .where("id", "=", existing.id)
        .execute();
      scheduleId = existing.id;
    } else {
      const inserted = await db
        .insertInto("lessonSchedules")
        .values({
          enrollmentId: input.enrollmentId,
          lessonNumber: input.lessonNumber,
          scheduledAt,
          notification24hId,
          notification1hId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      scheduleId = inserted.id;
    }

    return new Response(
      superjson.stringify({ success: true, scheduleId } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error scheduling lesson:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
