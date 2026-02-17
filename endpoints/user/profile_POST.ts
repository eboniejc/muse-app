import { getServerUserSession } from "../../helpers/getServerUserSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import superjson from "superjson";
import { schema, OutputType } from "./profile_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const payload = {
      userid: user.id,
      fullName: input.fullName,
      gender: input.gender ?? null,
      address: input.address ?? null,
      phoneNumber: input.phoneNumber,
      dateOfBirth: input.dateOfBirth ?? null,
      preferredPaymentMethod: input.preferredPaymentMethod ?? null,
      bankAccountName: input.bankAccountName ?? null,
      bankAccountNumber: input.bankAccountNumber ?? null,
      bankName: input.bankName ?? null,
      registrationCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from("userprofiles")
      .upsert(payload, { onConflict: "userid" })
      .select("id")
      .maybeSingle();

    if (profileErr) {
      throw profileErr;
    }

    if (!profileRow) {
      throw new Error("Failed to upsert user profile");
    }

    return new Response(
      superjson.stringify({
        success: true,
        profileId: profileRow.id,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error updating profile:", error);
    return new Response(
      superjson.stringify({ error: "Failed to update profile" }),
      { status: 500 }
    );
  }
}
