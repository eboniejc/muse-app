import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./list_GET.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    // Parse query params manually since GET requests don't have body
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
    };

    const input = schema.parse(queryParams);

    let query = db
      .selectFrom("roomBookings")
      .innerJoin("rooms", "roomBookings.roomId", "rooms.id")
      .innerJoin("users", "roomBookings.userId", "users.id")
      .select([
        "roomBookings.id",
        "roomBookings.startTime",
        "roomBookings.endTime",
        "roomBookings.status",
        "roomBookings.notes",
        "roomBookings.roomId",
        "roomBookings.userId",
        "rooms.name as roomName",
        "users.displayName as userName",
        "users.email as userEmail",
      ]);

    if (input.roomId) {
      query = query.where("roomBookings.roomId", "=", input.roomId);
    }

    if (input.startDate) {
      query = query.where("roomBookings.endTime", ">=", input.startDate);
    }

    if (input.endDate) {
      query = query.where("roomBookings.startTime", "<=", input.endDate);
    }

    // Order by start time
    query = query.orderBy("roomBookings.startTime", "asc");

    const bookings = await query.execute();

    return new Response(
      superjson.stringify({
        bookings: bookings.map((b) => ({
          id: b.id,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          notes: b.notes,
          roomId: b.roomId,
          userId: b.userId,
          roomName: b.roomName,
          userName: b.userName,
          userEmail: b.userEmail,
        })),
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Error listing bookings:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch bookings" }),
      { status: 500 }
    );
  }
}