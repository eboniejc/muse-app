// OAuth callback endpoint removed.
// Using Supabase auth is recommended instead. Supabase handles callbacks automatically.

export async function handle(request: Request) {
  return new Response(JSON.stringify({
    error: "OAuth callback endpoints removed. Supabase handles OAuth callbacks automatically in the client SDK."
  }), { status: 410, headers: { 'Content-Type': 'application/json' } });
}
