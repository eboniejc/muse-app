import { supabaseAdmin } from "../../helpers/supabaseServer";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./profile_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Fetch user profile and basic user info from Supabase
    const { data: profiles, error: err } = await supabaseAdmin
      .from('users')
      .select('id,email,displayname,avatarUrl,role,whatsappNumber,userprofiles(fullName,gender,address,phoneNumber,dateOfBirth,preferredPaymentMethod,bankAccountName,bankAccountNumber,bankName,registrationCompleted)')
      .eq('id', user.id)
      .limit(1);

    if (err) throw err;
    const userRec = profiles?.[0];
    if (!userRec) {
      return new Response(
        superjson.stringify({ error: "User not found" }),
        { status: 404 }
      );
    }

    const profile = {
      userId: userRec.id,
      email: userRec.email,
      displayName: userRec.displayname,
      avatarUrl: userRec.avatarUrl,
      role: userRec.role,
      whatsappNumber: userRec.whatsappNumber,
      ...(userRec.userprofiles?.[0] || {}),

    if (!profile) {
      // Should not happen if session is valid, but handle gracefully
      return new Response(
        superjson.stringify({ error: "User not found" }),
        { status: 404 }
      );
    }

    return new Response(
      superjson.stringify({
        profile: {
          ...profile,
          // Ensure dateOfBirth is handled correctly by superjson (it's a Date object from db)
          registrationCompleted: profile.registrationCompleted ?? false,
        },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error fetching profile:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch profile" }),
      { status: 500 }
    );
  }
}