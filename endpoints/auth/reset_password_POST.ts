import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { validatePasswordPolicy } from "../../helpers/validatePasswordPolicy";

function verifyResetToken(token: string): { userId: string } | null {
  const secret = process.env.JWT_SECRET ?? "";
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts;
  const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }

  const data = Buffer.from(payload, "base64url").toString();
  const colonIdx = data.lastIndexOf(":");
  if (colonIdx === -1) return null;

  const userId = data.slice(0, colonIdx);
  const expiryMs = Number(data.slice(colonIdx + 1));

  if (!userId || !Number.isFinite(expiryMs) || Date.now() > expiryMs) {
    return null;
  }

  return { userId };
}

export async function handle(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return Response.json({ message: "Invalid reset link" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return Response.json({ message: "Password is required" }, { status: 400 });
    }

    const verified = verifyResetToken(token);
    if (!verified) {
      return Response.json(
        { message: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id,email,displayName,displayname")
      .eq("id", verified.userId)
      .limit(1)
      .maybeSingle();

    if (!userRow) {
      return Response.json({ message: "User not found" }, { status: 404 });
    }

    const policyError = validatePasswordPolicy(password, {
      email: userRow.email,
      displayName: userRow.displayName ?? userRow.displayname,
    });
    if (policyError) {
      return Response.json({ message: policyError }, { status: 400 });
    }

    const passwordHash = await generatePasswordHash(password);

    // Upsert so it works whether the user has an existing password row or not
    const { error } = await supabaseAdmin
      .from("userpasswords")
      .upsert({ userid: userRow.id, passwordhash: passwordHash }, { onConflict: "userid" });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return Response.json({ message: "Failed to reset password. Please try again." }, { status: 500 });
  }
}
