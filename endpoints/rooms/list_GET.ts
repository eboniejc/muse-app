import { db } from "../../helpers/db";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    // Public endpoint, no auth required

    const rooms = await db
      .selectFrom("rooms")
      .select([
        "id",
        "name",
        "description",
        "roomType",
        "capacity",
        "equipment",
        "hourlyRate",
        "isActive",
      ])
      .where("isActive", "=", true)
      .orderBy("name", "asc")
      .execute();

    return new Response(
      superjson.stringify({
        rooms: rooms.map((room) => ({
          ...room,
          // Ensure numeric/decimal types are handled correctly if needed, though kysely-postgres-js usually handles them well.
          // hourlyRate is Numeric in schema, which might come back as string.
          hourlyRate: room.hourlyRate ? String(room.hourlyRate) : null,
        })),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error listing rooms:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch rooms" }),
      { status: 500 }
    );
  }
}