// OAuth authorization endpoint removed.
// Using Supabase auth is recommended instead. Client-side call example:
// await supabase.auth.signInWithOAuth({ provider: 'google' })

export async function handle(request: Request) {
  return new Response(JSON.stringify({
    error: "OAuth endpoints removed. Use Supabase client-side auth (supabase.auth.signInWithOAuth)."
  }), { status: 410, headers: { 'Content-Type': 'application/json' } });
}
