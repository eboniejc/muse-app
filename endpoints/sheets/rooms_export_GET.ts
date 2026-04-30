import { supabaseAdmin } from "../../helpers/supabaseServer";
import superjson from "superjson";
import { format } from "date-fns";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    let query = supabaseAdmin
      .from("room_bookings" as any)
      .select("id, start_time, end_time, status, notes, user_id, room_id")
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (startDateParam) query = query.gte("start_time", new Date(startDateParam).toISOString()) as any;
    if (endDateParam) query = query.lte("start_time", new Date(endDateParam).toISOString()) as any;

    const { data: bookings, error } = await query;

    if (error) throw error;

    if (!bookings || bookings.length === 0) {
      return new Response(superjson.stringify({ bookings: [] }));
    }

    const roomIds = [...new Set((bookings as any[]).map((b: any) => b.room_id))];
    const userIds = [...new Set((bookings as any[]).map((b: any) => b.user_id))];

    const [{ data: rooms }, { data: users }] = await Promise.all([
      supabaseAdmin.from("rooms").select("id, name").in("id", roomIds as any[]),
      supabaseAdmin.from("users").select("id, displayname, email").in("id", userIds as any[]),
    ]);

    const roomMap = new Map((rooms ?? []).map((r: any) => [String(r.id), r.name]));
    const userMap = new Map((users ?? []).map((u: any) => [String(u.id), { name: u.displayname ?? u.email, email: u.email }]));

    const result = (bookings as any[]).map((b: any) => ({
      date: format(new Date(b.start_time), "yyyy-MM-dd"),
      startTime: format(new Date(b.start_time), "HH:mm"),
      endTime: format(new Date(b.end_time), "HH:mm"),
      roomName: roomMap.get(String(b.room_id)) ?? `Room ${b.room_id}`,
      studentName: userMap.get(String(b.user_id))?.name ?? `User ${b.user_id}`,
      studentEmail: userMap.get(String(b.user_id))?.email ?? "",
      status: b.status,
    }));

    return new Response(superjson.stringify({ bookings: result }));
  } catch (error) {
    console.error("Error exporting room bookings:", error);
    return new Response(
      superjson.stringify({ error: "Failed to export room bookings" }),
      { status: 500 }
    );
  }
}
