import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./list_GET.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const url = new URL(request.url);
    const queryParams = {
      roomId: url.searchParams.get("roomId")
        ? Number(url.searchParams.get("roomId"))
        : undefined,
      startDate: url.searchParams.get("startDate")
        ? new Date(url.searchParams.get("startDate")!)
        : undefined,
      endDate: url.searchParams.get("endDate")
        ? new Date(url.searchParams.get("endDate")!)
        : undefined,
      mine: url.searchParams.get("mine") === "true",
    };

    const input = schema.parse(queryParams);

    // For "mine" queries use Supabase which handles UUID user_id natively
    if (input.mine) {
      let q = supabaseAdmin
        .from("room_bookings" as any)
        .select("id, start_time, end_time, status, notes, room_id, user_id")
        .eq("user_id", user.id as any)
        .order("start_time", { ascending: true });

      if (input.startDate) {
        q = q.gte("start_time", input.startDate.toISOString()) as any;
      }
      if (input.endDate) {
        q = q.lte("start_time", input.endDate.toISOString()) as any;
      }

      const { data: rows, error } = await q;
      if (error) throw error;

      if (!rows || rows.length === 0) {
        return new Response(superjson.stringify({ bookings: [] } satisfies OutputType));
      }

      const roomIds = [...new Set((rows as any[]).map((b: any) => b.room_id).filter(Boolean))];
      const { data: rooms } = await supabaseAdmin
        .from("rooms")
        .select("id, name")
        .in("id", roomIds as any[]);

      const roomMap = new Map((rooms ?? []).map((r: any) => [String(r.id), r.name]));

      return new Response(
        superjson.stringify({
          bookings: (rows as any[]).map((b: any) => ({
            id: b.id,
            startTime: new Date(b.start_time),
            endTime: new Date(b.end_time),
            status: b.status,
            notes: b.notes,
            roomId: b.room_id,
            userId: b.user_id,
            roomName: roomMap.get(String(b.room_id)) ?? `Room ${b.room_id}`,
            userName: "",
            userEmail: "",
          })),
        } satisfies OutputType)
      );
    }

    // Non-mine: use Supabase for the room-filtered schedule view
    let q = supabaseAdmin
      .from("room_bookings" as any)
      .select("id, start_time, end_time, status, notes, room_id, user_id")
      .order("start_time", { ascending: true });

    if (input.roomId) {
      q = q.eq("room_id", input.roomId) as any;
    }
    if (input.startDate) {
      q = q.gte("start_time", input.startDate.toISOString()) as any;
    }
    if (input.endDate) {
      q = q.lte("start_time", input.endDate.toISOString()) as any;
    }

    const { data: rows, error: bookingsErr } = await q;
    if (bookingsErr) throw bookingsErr;

    if (!rows || rows.length === 0) {
      return new Response(superjson.stringify({ bookings: [] } satisfies OutputType));
    }

    const roomIds = [...new Set((rows as any[]).map((b: any) => b.room_id).filter(Boolean))];
    const userIds = [...new Set((rows as any[]).map((b: any) => b.user_id).filter(Boolean))];

    const [{ data: rooms }, { data: users }] = await Promise.all([
      supabaseAdmin.from("rooms").select("id, name").in("id", roomIds as any[]),
      supabaseAdmin.from("users").select("id, displayname, email").in("id", userIds as any[]),
    ]);

    const roomMap = new Map((rooms ?? []).map((r: any) => [String(r.id), r.name]));
    const userMap = new Map((users ?? []).map((u: any) => [
      String(u.id),
      { name: u.displayname ?? u.email, email: u.email },
    ]));

    return new Response(
      superjson.stringify({
        bookings: (rows as any[]).map((b: any) => {
          const u = userMap.get(String(b.user_id));
          return {
            id: b.id,
            startTime: new Date(b.start_time),
            endTime: new Date(b.end_time),
            status: b.status,
            notes: b.notes,
            roomId: b.room_id,
            userId: b.user_id,
            roomName: roomMap.get(String(b.room_id)) ?? `Room ${b.room_id}`,
            userName: u?.name ?? `User ${b.user_id}`,
            userEmail: u?.email ?? "",
          };
        }),
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error listing bookings:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch bookings" }),
      { status: 500 }
    );
  }
}
