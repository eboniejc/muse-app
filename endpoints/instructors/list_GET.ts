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

    const formattedInstructors = instructors.map((inst) => ({
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
      whatsappNumber:
        (inst as any).whatsappNumber ??
        (inst as any).whatsappnumber ??
        (inst as any).whatsapp_number ??
        null,
      whatsappLink:
        ((inst as any).whatsappNumber ??
          (inst as any).whatsappnumber ??
          (inst as any).whatsapp_number)
          ? `https://wa.me/${String(
              (inst as any).whatsappNumber ??
                (inst as any).whatsappnumber ??
                (inst as any).whatsapp_number
            ).replace(/[^0-9]/g, "")}`
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
