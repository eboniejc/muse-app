import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { generatePasswordHash } from "../../../helpers/generatePasswordHash";

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    const { email, newPassword } = await request.json();

    if (!email || typeof email !== "string") {
      return Response.json({ message: "Email is required" }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return Response.json({ message: "Password must be at least 6 characters" }, { status: 400 });
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle();

    if (!userRow) {
      return Response.json({ message: "No account found with that email" }, { status: 404 });
    }

    const passwordHash = await generatePasswordHash(newPassword);

    // Upsert into userpasswords table
    const { error } = await supabaseAdmin
      .from("userpasswords")
      .upsert({ userid: userRow.id, passwordhash: passwordHash }, { onConflict: "userid" });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return Response.json({ message: "Not authenticated" }, { status: 401 });
    }
    console.error("Admin reset password error:", error);
    return Response.json({ message: "Something went wrong" }, { status: 500 });
  }
}
