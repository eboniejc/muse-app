import { db } from "../../helpers/db";
import { validateSheetsApiKey } from "../../helpers/validateSheetsApiKey";
import { OutputType } from "./export_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const validation = validateSheetsApiKey(request);
    if (!validation.valid) {
      return validation.response;
    }

    // Parallelize queries for efficiency
    const [
      courses,
      ebooks,
      rooms,
      roomBookings,
      courseEnrollments,
      lessonCompletions,
      lessonSchedules,
      users,
      userProfiles,
    ] = await Promise.all([
      db.selectFrom("courses").selectAll().execute(),
      db.selectFrom("ebooks").selectAll().execute(),
      db.selectFrom("rooms").selectAll().execute(),
      db
        .selectFrom("roomBookings")
        .innerJoin("users", "roomBookings.userId", "users.id")
        .innerJoin("rooms", "roomBookings.roomId", "rooms.id")
        .selectAll("roomBookings")
        .select(["users.displayName as userName", "rooms.name as roomName"])
        .execute(),
      db
        .selectFrom("courseEnrollments")
        .innerJoin("users", "courseEnrollments.userId", "users.id")
        .selectAll("courseEnrollments")
        .select(["users.displayName as studentName", "users.email as studentEmail"])
        .execute(),
      db.selectFrom("lessonCompletions").selectAll().execute(),
      db.selectFrom("lessonSchedules").selectAll().execute(),
      db.selectFrom("users").selectAll().execute(),
      db.selectFrom("userProfiles").selectAll().execute(),
    ]);

    const exportData = {
      courses,
      ebooks,
      rooms,
      roomBookings,
      courseEnrollments,
      lessonCompletions,
      lessonSchedules,
      users,
      userProfiles,
    };

    return new Response(
      superjson.stringify({ data: exportData } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error exporting sheets data:", error);
    return new Response(
      superjson.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}