import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { schema } from "./login_with_password_POST.schema";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import { User } from "../../helpers/User";

function normalizeUserRow(userRow: any): User {
  return {
    id: userRow.id,
    email: userRow.email,
    displayName:
      userRow.displayName ??
      userRow.displayname ??
      userRow.display_name ??
      userRow.email,
    avatarUrl:
      userRow.avatarUrl ?? userRow.avatarurl ?? userRow.avatar_url ?? null,
    role: userRow.role,
  };
}

export async function handle(request: Request) {
  try {
    const json = await request.json();
    const { email, password } = schema.parse(json);
    const normalizedEmail = email.toLowerCase();

    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (userErr) {
      throw userErr;
    }

    if (!userRow) {
      return Response.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const { data: passwordRow, error: passwordErr } = await supabaseAdmin
      .from("userpasswords")
      .select("passwordhash")
      .eq("userid", userRow.id)
      .limit(1)
      .maybeSingle();

    if (passwordErr) {
      throw passwordErr;
    }

    if (!passwordRow) {
      return Response.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const passwordValid = await compare(password, passwordRow.passwordhash);
    if (!passwordValid) {
      return Response.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sessionId = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);

    const { error: sessionErr } = await supabaseAdmin.from("sessions").insert({
      id: sessionId,
      userid: userRow.id,
      createdat: now.toISOString(),
      lastaccessed: now.toISOString(),
      expiresat: expiresAt.toISOString(),
    });

    if (sessionErr) {
      throw sessionErr;
    }

    const userData = normalizeUserRow(userRow);

    const response = Response.json({ user: userData });

    await setServerSession(response, {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ message: "Authentication failed" }, { status: 400 });
  }
}
