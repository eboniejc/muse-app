import { supabaseAdmin } from "../../helpers/supabaseServer";
import { schema } from "./establish_session_POST.schema";
import { setServerSession } from "../../helpers/getSetServerSession";
import { randomBytes } from "crypto";

export async function handle(request: Request) {
  try {
    const json = await request.json();
    const { tempToken } = schema.parse(json);

    // Look up the temp session using literal column names (DB has all-lowercase, no underscores)
    const { data: tempSession } = await supabaseAdmin
      .from("sessions")
      .select("id, userid, expiresat")
      .eq("id", tempToken)
      .limit(1)
      .maybeSingle();

    if (!tempSession) {
      return Response.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Check expiry
    const now = new Date();
    if (new Date((tempSession as any).expiresat) < now) {
      await supabaseAdmin.from("sessions").delete().eq("id", tempToken);
      return Response.json({ error: "Token has expired" }, { status: 400 });
    }

    // Fetch the user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, displayname, role")
      .eq("id", (tempSession as any).userid)
      .maybeSingle();

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 400 });
    }

    // Delete the temp session immediately (single-use)
    await supabaseAdmin.from("sessions").delete().eq("id", tempToken);

    // Create a new proper session
    const newSessionId = randomBytes(32).toString("hex");
    const now2 = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from("sessions").insert({
      id: newSessionId,
      userid: (user as any).id,
      createdat: now2,
      lastaccessed: now2,
      expiresat: expiresAt,
    } as any);

    const userData = {
      id: (user as any).id,
      email: (user as any).email,
      displayName: (user as any).displayname,
      role: ((user as any).role as "admin" | "user") || "user",
    };

    const response = Response.json({ user: userData, success: true });

    await setServerSession(response, {
      id: newSessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    return response;
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
