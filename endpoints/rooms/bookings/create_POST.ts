import { db } from "../../../helpers/db";
import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType, schema } from "./create_POST.schema";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { subDays } from "date-fns";

const PRACTICE_HOURS_LIMIT = 30;
const PERIOD_DAYS = 42; // 6 weeks

async function getEffectiveHoursLimit(userId: number): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from("practiceHoursOverrides" as any)
      .select("totalHours")
      .eq("userId", userId as any)
      .maybeSingle();
    return (data as any)?.totalHours ?? PRACTICE_HOURS_LIMIT;
  } catch {
    return PRACTICE_HOURS_LIMIT;
  }
}

async function hasActiveEnrollment(userId: number): Promise<boolean> {
  const [camel, snake] = await Promise.all([
    supabaseAdmin
      .from("courseEnrollments")
      .select("id")
      .eq("userId", userId as any)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("course_enrollments")
      .select("id")
      .eq("user_id", userId as any)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);
  return !!(camel.data || snake.data);
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const isAdmin = user.role === "admin";
    const bookingUserId = isAdmin && input.targetUserId ? input.targetUserId : user.id;

    // Enforce exactly 1 hour
    const durationMs = new Date(input.endTime).getTime() - new Date(input.startTime).getTime();
    if (Math.abs(durationMs - 60 * 60 * 1000) > 60000) {
      return new Response(
        superjson.stringify({ error: "Bookings must be exactly 1 hour" }),
        { status: 400 }
      );
    }

    // Enforce 9am–9pm window in Vietnam time (UTC+7)
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const startVN = new Date(new Date(input.startTime).getTime() + VN_OFFSET_MS);
    const endVN = new Date(new Date(input.endTime).getTime() + VN_OFFSET_MS);
    const startHour = startVN.getUTCHours();
    const endHour = endVN.getUTCHours();
    const endMinutes = endVN.getUTCMinutes();
    if (startHour < 9 || endHour > 21 || (endHour === 21 && endMinutes > 0)) {
      return new Response(
        superjson.stringify({ error: "Bookings must be between 9:00 and 21:00" }),
        { status: 400 }
      );
    }

    if (!isAdmin) {
      // Enrollment check
      const enrolled = await hasActiveEnrollment(bookingUserId);
      if (!enrolled) {
        return new Response(
          superjson.stringify({ error: "No active enrollment found. You must be enrolled in a course to book practice time." }),
          { status: 403 }
        );
      }

      // Quota check — count non-cancelled bookings in rolling 6-week window
      const periodStart = subDays(new Date(), PERIOD_DAYS);
      const usedResult = await db
        .selectFrom("roomBookings")
        .select((eb) => eb.fn.count("id").as("count"))
        .where("userId", "=", bookingUserId)
        .where("status", "!=", "cancelled")
        .where("startTime", ">=", periodStart)
        .executeTakeFirst();

      const hoursUsed = Number(usedResult?.count ?? 0);
      const effectiveLimit = await getEffectiveHoursLimit(bookingUserId);

      if (hoursUsed >= effectiveLimit) {
        return new Response(
          superjson.stringify({ error: `Practice hour limit reached (${effectiveLimit} hours per 6 weeks)` }),
          { status: 403 }
        );
      }
    }

    // Overlap check
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
        superjson.stringify({ error: "Room is already booked for this time slot" }),
        { status: 409 }
      );
    }

    const newBooking = await db
      .insertInto("roomBookings")
      .values({
        userId: bookingUserId,
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
      superjson.stringify({ booking: newBooking } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error creating booking:", error);
    return new Response(
      superjson.stringify({ error: "Failed to create booking" }),
      { status: 500 }
    );
  }
}
