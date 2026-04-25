import { compare } from "bcryptjs";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { supabaseAdmin } from "../../helpers/supabaseServer";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || typeof currentPassword !== "string") {
      return Response.json({ message: "Current password is required" }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return Response.json({ message: "New password must be at least 6 characters" }, { status: 400 });
    }

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

    const passwordHash = await generatePasswordHash(newPassword);
    const { error } = await supabaseAdmin
      .from("userpasswords")
      .update({ passwordhash: passwordHash })
      .eq("userid", user.id);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return Response.json({ message: "Not authenticated" }, { status: 401 });
    }
    console.error("Update password error:", error);
    return Response.json({ message: "Something went wrong" }, { status: 500 });
  }
}
