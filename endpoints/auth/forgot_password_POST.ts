import { createHmac } from "crypto";
import { supabaseAdmin } from "../../helpers/supabaseServer";

function generateResetToken(userId: string): string {
  const secret = process.env.JWT_SECRET ?? "";
  const expiryMs = Date.now() + 60 * 60 * 1000; // 1 hour
  const data = `${userId}:${expiryMs}`;
  const payload = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export async function handle(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return Response.json({ message: "Email is required" }, { status: 400 });
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id,email,displayName,displayname")
      .ilike("email", email.trim().toLowerCase())
      .limit(1)
      .maybeSingle();

    // Always return success to avoid leaking whether an email exists
    if (!userRow) {
      return Response.json({ success: true });
    }

    const token = generateResetToken(String(userRow.id));
    const origin = request.headers.get("origin") ?? "https://museinc.com.vn";
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    const displayName = userRow.displayName ?? userRow.displayname ?? userRow.email;

    return Response.json({ success: true, resetUrl });
  } catch (error) {
    console.error("Forgot password error:", error);
    return Response.json({ success: true }); // still return success to avoid leaking info
  }
}
