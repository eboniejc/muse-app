import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./cancel_POST.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const { bookingId } = schema.parse(json);

    const booking = await db
      .selectFrom("roomBookings")
      .select(["userId", "status"])
      .where("id", "=", bookingId)
      .executeTakeFirst();

    if (!booking) {
      return new Response(
        superjson.stringify({ error: "Booking not found" }),
        { status: 404 }
      );
    }

    // Only allow cancellation if user owns the booking or is an admin
    if (booking.userId !== user.id && user.role !== "admin") {
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

    const updatedBooking = await db
      .updateTable("roomBookings")
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where("id", "=", bookingId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        booking: updatedBooking,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error cancelling booking:", error);
    return new Response(
      superjson.stringify({ error: "Failed to cancel booking" }),
      { status: 500 }
    );
  }
}