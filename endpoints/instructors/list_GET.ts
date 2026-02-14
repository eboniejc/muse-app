import { db } from "../../helpers/db";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    // Public endpoint - no auth check needed

    const instructors = await db
      .selectFrom("users")
      .select(["id", "displayName", "email", "avatarUrl", "whatsappNumber"])
      .where("role", "=", "instructor")
      .execute();

    const formattedInstructors = instructors.map((inst) => ({
      ...inst,
      whatsappLink: inst.whatsappNumber
        ? `https://wa.me/${inst.whatsappNumber.replace(/[^0-9]/g, "")}`
        : null,
    }));

    return new Response(
      superjson.stringify({
        instructors: formattedInstructors,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error listing instructors:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch instructors" }),
      { status: 500 }
    );
  }
}