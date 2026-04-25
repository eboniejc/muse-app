import { compare } from "bcryptjs";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { currentPassword, newEmail } = await request.json();

    if (!currentPassword || typeof currentPassword !== "string") {
      return Response.json({ message: "Current password is required" }, { status: 400 });
    }
    if (!newEmail || typeof newEmail !== "string" || !newEmail.includes("@")) {
      return Response.json({ message: "A valid email is required" }, { status: 400 });
    }

    const normalized = newEmail.trim().toLowerCase();

    const { data: passwordRow } = await supabaseAdmin
      .from("userpasswords")
      .select("passwordhash")
      .eq("userid", user.id)
      .maybeSingle();

    if (!passwordRow) {
      return Response.json({ message: "No password set for this account" }, { status: 400 });
    }

    const valid = await compare(currentPassword, passwordRow.passwordhash);
    if (!valid) {
      return Response.json({ message: "Current password is incorrect" }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("email", normalized)
      .maybeSingle();

    if (existing) {
      return Response.json({ message: "That email is already in use" }, { status: 409 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ email: normalized })
      .eq("id", user.id);
    if (error) throw error;

    return Response.json({ success: true, email: normalized });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return Response.json({ message: "Not authenticated" }, { status: 401 });
    }
    console.error("Update email error:", error);
    return Response.json({ message: "Something went wrong" }, { status: 500 });
  }
}
