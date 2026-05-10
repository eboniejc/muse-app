// adapt this to the database schema and helpers if necessary
import { supabaseAdmin } from "../../helpers/supabaseServer";
import { schema } from "./register_with_password_POST.schema";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { validatePasswordPolicy } from "../../helpers/validatePasswordPolicy";

export async function handle(request: Request) {
  try {
    const json = await request.json();
    const { email, password, displayName } = schema.parse(json);
    const policyError = validatePasswordPolicy(password, { email, displayName });
    if (policyError) {
      return Response.json({ message: policyError }, { status: 400 });
    }

    // Check if email already exists
    const { data: existingUser, error: existingErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (existingErr) throw existingErr
    if (existingUser && existingUser.length > 0) {
      return Response.json({ message: 'email already in use' }, { status: 409 })
    }

    const passwordHash = await generatePasswordHash(password)

    // Create new user (using supabase HTTP API)
    const { data: insertedUsers, error: insertUserErr } = await supabaseAdmin
      .from('users')
      .insert({ email, displayname: displayName, role: 'user' })
      .select('id,email,displayname,createdAt')

    if (insertUserErr) throw insertUserErr
    const newUser = Array.isArray(insertedUsers) ? insertedUsers[0] : insertedUsers

    // Store the password hash in another table
    const { error: pwErr } = await supabaseAdmin.from('userpasswords').insert({
      userid: newUser.id,
      passwordhash: passwordHash,
    })

    if (pwErr) {
      // cleanup user if passwords insert failed
      await supabaseAdmin.from('users').delete().eq('id', newUser.id)
      throw pwErr
    }

    // Create a new session
    const sessionId = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);

    const { error: sessionErr } = await supabaseAdmin.from('sessions').insert({
      id: sessionId,
      userid: newUser.id,
      createdat: now.toISOString(),
      lastaccessed: now.toISOString(),
      expiresat: expiresAt.toISOString(),
    })

    if (sessionErr) {
      // Cleanup created records on failure
      await supabaseAdmin.from('userpasswords').delete().eq('userid', newUser.id)
      await supabaseAdmin.from('users').delete().eq('id', newUser.id)
      throw sessionErr
    }

    // Create response with user data
    const response = Response.json({
      user: {
        ...newUser,
        role: "user" as const,
      },
    });

    // Set session cookie
    await setServerSession(response, {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });

    return response;
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Registration failed";
    return Response.json({ message: errorMessage }, { status: 400 });
  }
}
