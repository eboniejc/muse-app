import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { sendPushNotification } from "../../../helpers/sendPushNotification";
import { schema, OutputType } from "./notify_POST.schema";
import superjson from "superjson";

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

    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select("id,title,startAt")
      .eq("id", input.eventId)
      .eq("isActive", true)
      .limit(1)
      .maybeSingle();

    if (error || !event) {
      return new Response(
        superjson.stringify({ error: "Event not found" }),
        { status: 404 }
      );
    }

    const startAt = new Date(event.startAt);
    const now = new Date();
    const notify24hAt = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
    const notify1hAt = new Date(startAt.getTime() - 60 * 60 * 1000);

    const scheduled: string[] = [];

    if (notify24hAt > now) {
      const id = await sendPushNotification({
        headings: {
          en: "Event Tomorrow",
          vi: "Sự kiện vào ngày mai",
        },
        contents: {
          en: `Reminder: "${event.title}" is happening tomorrow!`,
          vi: `Nhắc nhở: "${event.title}" sẽ diễn ra vào ngày mai!`,
        },
        segments: ["Subscribed Users"],
        send_after: notify24hAt,
        data: { eventId: event.id },
      });
      if (id) scheduled.push("24h");
    }

    if (notify1hAt > now) {
      const id = await sendPushNotification({
        headings: {
          en: "Event in 1 Hour",
          vi: "Sự kiện sau 1 giờ",
        },
        contents: {
          en: `"${event.title}" starts in 1 hour. Don't miss it!`,
          vi: `"${event.title}" bắt đầu sau 1 giờ. Đừng bỏ lỡ!`,
        },
        segments: ["Subscribed Users"],
        send_after: notify1hAt,
        data: { eventId: event.id },
      });
      if (id) scheduled.push("1h");
    }

    return new Response(
      superjson.stringify({ success: true, scheduled } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error scheduling event notifications:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
