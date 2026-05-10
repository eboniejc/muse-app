import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./cancel_POST.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { bookingId } = schema.parse(json);

    const { data: booking } = await supabaseAdmin
      .from("room_bookings")
      .select("user_id, status")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) {
      return new Response(
        superjson.stringify({ error: "Booking not found" }),
        { status: 404 }
      );
    }

    if (String(booking.user_id) !== String(user.id) && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Not authorized to cancel this booking" }),
        { status: 403 }
      );
    }

    if (booking.status === "cancelled") {
      return new Response(
        superjson.stringify({ error: "Booking is already cancelled" }),
        { status: 400 }
      );
    }

    const { data: row, error: updateErr } = await supabaseAdmin
      .from("room_bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .select("*")
      .single();
    if (updateErr) throw updateErr;

    const updatedBooking = {
      id: row.id,
      userId: row.user_id,
      roomId: row.room_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };

    return new Response(
      superjson.stringify({ booking: updatedBooking } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error cancelling booking:", error);
    return new Response(
      superjson.stringify({ error: "Failed to cancel booking" }),
      { status: 500 }
    );
  }
}
