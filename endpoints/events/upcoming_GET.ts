import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import superjson from "superjson";
import { OutputType } from "./upcoming_GET.schema";

function isSchemaError(error: any): boolean {
  const message = String(error?.message ?? "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);
    const nowIso = new Date().toISOString();

    let events: any[] = [];
    let eventsErr: any = null;
    ({ data: events, error: eventsErr } = await supabaseAdmin
      .from("events")
      .select("id,title,caption,flyerUrl,startAt,endAt,isActive")
      .eq("isActive", true)
      .gte("startAt", nowIso)
      .order("startAt", { ascending: true }));

    if (eventsErr || !events) {
      if (eventsErr && !isSchemaError(eventsErr)) throw eventsErr;
      return new Response(
        superjson.stringify({ events: [] } satisfies OutputType)
      );
    }

    return new Response(
      superjson.stringify({
        events: (events ?? []).map((event: any) => ({
          id: event.id,
          title: event.title,
          caption: event.caption ?? null,
          flyerUrl: event.flyerUrl ?? null,
          startAt: event.startAt,
          endAt: event.endAt ?? null,
        })),
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error fetching upcoming events:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch upcoming events" }),
      { status: 500 }
    );
  }
}

