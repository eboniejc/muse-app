import { supabaseAdmin } from "../../helpers/supabaseServer";
import { db } from "../../helpers/db";
import superjson from "superjson";
import { subDays, format } from "date-fns";

const PRACTICE_HOURS_LIMIT = 30;
const PERIOD_DAYS = 42;

export async function handle(request: Request) {
  try {
    const periodStart = subDays(new Date(), PERIOD_DAYS);

    // Get all enrolled users from both enrollment tables
    const [camelEnroll, snakeEnroll] = await Promise.all([
      supabaseAdmin.from("courseEnrollments").select("userId").eq("status", "active" as any),
      supabaseAdmin.from("course_enrollments").select("user_id").eq("status", "active" as any),
    ]);

    const enrolledUserIds = new Set<string>([
      ...((camelEnroll.data ?? []) as any[]).map((e: any) => String(e.userId)).filter(Boolean),
      ...((snakeEnroll.data ?? []) as any[]).map((e: any) => String(e.user_id)).filter(Boolean),
    ]);

    if (enrolledUserIds.size === 0) {
      return new Response(superjson.stringify({ students: [] }));
    }

    // Get all non-cancelled bookings in the current period
    const bookingCounts = await db
      .selectFrom("roomBookings")
      .select(["userId", (eb) => eb.fn.count("id").as("count")])
      .where("status", "!=", "cancelled")
      .where("startTime", ">=", periodStart)
      .where("userId" as any, "in", [...enrolledUserIds])
      .groupBy("userId")
      .execute();

    const usedMap = new Map(bookingCounts.map((b: any) => [String(b.userId), Number(b.count)]));

    // Get overrides
    const { data: overrides } = await supabaseAdmin
      .from("practiceHoursOverrides" as any)
      .select("userId, totalHours");

    const overrideMap = new Map(
      ((overrides ?? []) as any[]).map((o: any) => [String(o.userId), Number(o.totalHours)])
    );

    // Get user info
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, displayname, email")
      .in("id", [...enrolledUserIds] as any[]);

    const userMap = new Map((users ?? []).map((u: any) => [String(u.id), u]));

    const students = [...enrolledUserIds].map((userId) => {
      const user = userMap.get(userId);
      const hoursUsed = usedMap.get(userId) ?? 0;
      const overrideTotal = overrideMap.get(userId) ?? null;
      const effectiveTotal = overrideTotal ?? PRACTICE_HOURS_LIMIT;
      return {
        userId,
        studentName: (user as any)?.displayname ?? user?.email ?? `User ${userId}`,
        email: user?.email ?? "",
        hoursUsed,
        hoursRemaining: Math.max(0, effectiveTotal - hoursUsed),
        effectiveTotal,
        overrideTotal,
        periodStart: format(periodStart, "yyyy-MM-dd"),
      };
    });

    // Sort by name
    students.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return new Response(superjson.stringify({ students }));
  } catch (error) {
    console.error("Error exporting practice hours:", error);
    return new Response(
      superjson.stringify({ error: "Failed to export practice hours" }),
      { status: 500 }
    );
  }
}
