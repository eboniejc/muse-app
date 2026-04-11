import { db } from "../../../helpers/db";
import { supabaseAdmin } from "../../../helpers/supabaseServer";
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

    // Fetch enrollment to get the student's userId and course name via Supabase
    // (avoids Kysely CamelCase→snake_case mismatch for "courseEnrollments" table)
    const { data: enrollmentData } = await supabaseAdmin
      .from("courseEnrollments")
      .select("userId,courseId")
      .eq("id", input.enrollmentId as any)
      .maybeSingle();

    let enrollment: { userId: number; courseName: string } | null = null;
    if (enrollmentData) {
      const { data: courseData } = await supabaseAdmin
        .from("courses")
        .select("name")
        .eq("id", (enrollmentData as any).courseId)
        .maybeSingle();
      enrollment = {
        userId: (enrollmentData as any).userId,
        courseName: (courseData as any)?.name ?? "Course",
      };
    }

    if (!enrollment) {
      return new Response(
        superjson.stringify({ error: "Enrollment not found" }),
        { status: 404 }
      );
    }

    // Check for an existing schedule to cancel old notifications
    // Use Supabase to avoid Kysely camelCase→snake_case mismatch for "lessonSchedules"
    const { data: existingData } = await supabaseAdmin
      .from("lessonSchedules")
      .select("id,notification1hId,notification24hId")
      .eq("enrollmentId", input.enrollmentId as any)
      .eq("lessonNumber", input.lessonNumber as any)
      .maybeSingle();

    const existing = existingData as {
      id: number;
      notification1hId: string | null;
      notification24hId: string | null;
    } | null;

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

    // Upsert the lesson schedule row via Supabase
    let scheduleId: number;
    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from("lessonSchedules")
        .update({
          scheduledAt: scheduledAt.toISOString(),
          notification24hId,
          notification1hId,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existing.id as any);
      if (updateErr) throw updateErr;
      scheduleId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("lessonSchedules")
        .insert({
          enrollmentId: input.enrollmentId,
          lessonNumber: input.lessonNumber,
          scheduledAt: scheduledAt.toISOString(),
          notification24hId,
          notification1hId,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      scheduleId = (inserted as any).id;
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
