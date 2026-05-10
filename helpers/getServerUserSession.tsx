import { supabaseAdmin } from "./supabaseServer";
import { User } from "./User";

import {
  CleanupProbability,
  getServerSessionOrThrow,
  NotAuthenticatedError,
  SessionExpirationSeconds,
} from "./getSetServerSession";

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

export async function getServerUserSession(request: Request) {
  const session = await getServerSessionOrThrow(request);

  // Occasionally clean up expired sessions
  if (Math.random() < CleanupProbability) {
    const expirationDate = new Date(
      Date.now() - SessionExpirationSeconds * 1000
    );
    try {
      await supabaseAdmin
        .from("sessions")
        .delete()
        .lt("lastaccessed", expirationDate.toISOString());
    } catch (cleanupError) {
      // Log but don't fail the request if cleanup fails
      console.error("Session cleanup error:", cleanupError);
    }
  }

  const { data: sessionRow, error: sessionErr } = await supabaseAdmin
    .from("sessions")
    .select("id,userid,createdat,lastaccessed")
    .eq("id", session.id)
    .limit(1)
    .maybeSingle();

  if (sessionErr) {
    throw sessionErr;
  }

  if (!sessionRow) {
    throw new NotAuthenticatedError();
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", sessionRow.userid)
    .limit(1)
    .maybeSingle();

  if (userErr) {
    throw userErr;
  }

  if (!userRow) {
    throw new NotAuthenticatedError();
  }

  const user = normalizeUserRow(userRow);

  // Update the session's lastAccessed timestamp
  const now = new Date();
  const { error: updateErr } = await supabaseAdmin
    .from("sessions")
    .update({ lastaccessed: now.toISOString() })
    .eq("id", session.id);

  if (updateErr) {
    throw updateErr;
  }

  return {
    user: user satisfies User,
    // make sure to update the session in cookie
    session: {
      ...session,
      lastAccessed: now,
    },
  };
}
