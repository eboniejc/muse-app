import { db } from "../../helpers/db";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

function isSchemaOrMissingTableError(error: unknown): boolean {
  const maybeErr = error as { code?: string; message?: string } | null;
  if (!maybeErr) return false;
  return (
    maybeErr.code === "42703" ||
    maybeErr.code === "42P01" ||
    maybeErr.code === "PGRST205" ||
    maybeErr.message?.includes("does not exist") === true ||
    maybeErr.message?.includes("schema cache") === true
  );
}

export async function handle(request: Request) {
  try {
    // Public endpoint, no auth required

    const rooms = await db
      .selectFrom("rooms")
      .selectAll()
      .where("isActive", "=", true)
      .orderBy("name", "asc")
      .execute();

    return new Response(
      superjson.stringify({
        rooms: rooms.map((room) => ({
          id: room.id,
          name: room.name,
          description: room.description,
          roomType:
            (room as any).roomType ??
            (room as any).roomtype ??
            (room as any).room_type,
          capacity: room.capacity,
          equipment: room.equipment,
          isActive:
            (room as any).isActive ??
            (room as any).isactive ??
            (room as any).is_active,
          hourlyRate: (
            (room as any).hourlyRate ??
            (room as any).hourlyrate ??
            (room as any).hourly_rate
          )
            ? String(
                (room as any).hourlyRate ??
                  (room as any).hourlyrate ??
                  (room as any).hourly_rate
              )
            : null,
        })),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error listing rooms:", error);
    if (isSchemaOrMissingTableError(error)) {
      return new Response(
        superjson.stringify({ rooms: [] } satisfies OutputType)
      );
    }
    return new Response(
      superjson.stringify({ error: "Failed to fetch rooms" }),
      { status: 500 }
    );
  }
}
