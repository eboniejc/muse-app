import { db } from "../../helpers/db";
import { validateSheetsApiKey } from "../../helpers/validateSheetsApiKey";
import { OutputType } from "./export_POST.schema";
import superjson from "superjson";

async function safeSelectAll(table: string) {
  try {
    return await db.selectFrom(table as any).selectAll().execute();
  } catch (error) {
    console.error(`Sheets export: failed to query table ${table}:`, error);
    return [];
  }
}

export async function handle(request: Request) {
  try {
    const validation = validateSheetsApiKey(request);
    if (!validation.valid) {
      return validation.response;
    }

    // Export each table safely so one schema mismatch doesn't break the whole export.
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
      safeSelectAll("courses"),
      safeSelectAll("ebooks"),
      safeSelectAll("rooms"),
      safeSelectAll("roomBookings"),
      safeSelectAll("courseEnrollments"),
      safeSelectAll("lessonCompletions"),
      safeSelectAll("lessonSchedules"),
      safeSelectAll("users"),
      safeSelectAll("userProfiles"),
    ]);

    const exportData = {
      courses,
      ebooks,
      rooms,
      roomBookings: roomBookings.map((row: any) => ({
        ...row,
        userName: row.userName ?? "",
        roomName: row.roomName ?? "",
      })),
      courseEnrollments: courseEnrollments.map((row: any) => ({
        ...row,
        studentName: row.studentName ?? "",
        studentEmail: row.studentEmail ?? "",
      })),
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
