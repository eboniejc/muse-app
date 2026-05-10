import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./hours_GET.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { subDays } from "date-fns";

const PRACTICE_HOURS_LIMIT = 30;
const PERIOD_DAYS = 42;

async function getEffectiveHoursLimit(userId: number): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from("practiceHoursOverrides" as any)
      .select("totalHours")
      .eq("userId", userId as any)
      .maybeSingle();
    return (data as any)?.totalHours ?? PRACTICE_HOURS_LIMIT;
  } catch {
    return PRACTICE_HOURS_LIMIT;
  }
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const periodStart = subDays(new Date(), PERIOD_DAYS);
    const { count: usedCount } = await supabaseAdmin
      .from("room_bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id as any)
      .neq("status", "cancelled")
      .gte("start_time", periodStart.toISOString());

    const used = Number(usedCount ?? 0);
    const total = await getEffectiveHoursLimit(user.id);
    const remaining = Math.max(0, total - used);

    return new Response(
      superjson.stringify({ used, total, remaining } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error fetching hours:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch hours" }),
      { status: 500 }
    );
  }
}
