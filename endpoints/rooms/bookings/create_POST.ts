import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./create_POST.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Validate dates
    if (input.startTime >= input.endTime) {
      return new Response(
        superjson.stringify({ error: "End time must be after start time" }),
        { status: 400 }
      );
    }

    // Check for overlaps
    // We want to find if there is any booking for the same room that overlaps with the requested time range
    // Overlap logic: (StartA < EndB) and (EndA > StartB)
    const existingBooking = await db
      .selectFrom("roomBookings")
      .select("id")
      .where("roomId", "=", input.roomId)
      .where("status", "=", "confirmed")
      .where("startTime", "<", input.endTime)
      .where("endTime", ">", input.startTime)
      .limit(1)
      .executeTakeFirst();

    if (existingBooking) {
      return new Response(
        superjson.stringify({
          error: "Room is already booked for this time slot",
        }),
        { status: 409 }
      );
    }

    const newBooking = await db
      .insertInto("roomBookings")
      .values({
        userId: user.id,
        roomId: input.roomId,
        startTime: input.startTime,
        endTime: input.endTime,
        notes: input.notes ?? null,
        status: "confirmed",
        updatedAt: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        booking: newBooking,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error creating booking:", error);
    return new Response(
      superjson.stringify({ error: "Failed to create booking" }),
      { status: 500 }
    );
  }
}