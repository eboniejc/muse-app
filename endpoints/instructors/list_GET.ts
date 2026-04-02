import { db } from "../../helpers/db";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    // Public endpoint - no auth check needed

    const instructors = await db
      .selectFrom("users")
      .selectAll()
      .where("role", "=", "instructor")
      .execute();

    const formattedInstructors = instructors.map((inst) => {
      const rawPhone: string | null =
        (inst as any).whatsappNumber ??
        (inst as any).whatsappnumber ??
        (inst as any).whatsapp_number ??
        null;
      const digitsOnly = rawPhone ? rawPhone.replace(/[^0-9]/g, "") : null;
      // Zalo uses Vietnamese local format: remove leading country code 84, add 0
      const zaloLocal = digitsOnly
        ? digitsOnly.startsWith("84")
          ? "0" + digitsOnly.slice(2)
          : digitsOnly
        : null;
      return {
        id: inst.id,
        displayName:
          (inst as any).displayName ??
          (inst as any).displayname ??
          (inst as any).display_name ??
          "",
        email: inst.email,
        avatarUrl:
          (inst as any).avatarUrl ??
          (inst as any).avatarurl ??
          (inst as any).avatar_url ??
          null,
        whatsappNumber: rawPhone,
        whatsappLink: digitsOnly ? `https://wa.me/${digitsOnly}` : null,
        zaloLink: zaloLocal ? `https://zalo.me/${zaloLocal}` : null,
      };
    });

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
