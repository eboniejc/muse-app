import { supabaseAdmin } from "../../../helpers/supabaseServer";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, displayname, email")
      .order("displayname", { ascending: true });

    if (error) throw error;

    return new Response(
      superjson.stringify({ users: data ?? [] })
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error listing users:", error);
    return new Response(superjson.stringify({ error: "Failed to fetch users" }), { status: 500 });
  }
}
