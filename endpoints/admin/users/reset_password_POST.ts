import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { generatePasswordHash } from "../../../helpers/generatePasswordHash";

export async function handle(request: Request) {
  try {
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

    // Check if a password row already exists for this user
    const { data: existing } = await supabaseAdmin
      .from("userpasswords")
      .select("id")
      .eq("userid", userRow.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("userpasswords")
        .update({ passwordhash: passwordHash })
        .eq("userid", userRow.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("userpasswords")
        .insert({ userid: userRow.id, passwordhash: passwordHash });
      if (error) throw error;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return Response.json({ message: "Something went wrong" }, { status: 500 });
  }
}
