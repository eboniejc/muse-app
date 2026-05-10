import { getServerUserSession } from "../../helpers/getServerUserSession";
import { supabaseAdmin } from "../../helpers/supabaseServer";
import superjson from "superjson";
import { schema, OutputType } from "./profile_POST.schema";

async function upsertLowercaseProfileTable(userId: number, input: any) {
  return supabaseAdmin
    .from("userprofiles")
    .upsert(
      {
        userid: userId,
        fullname: input.fullName,
        gender: input.gender ?? null,
        address: input.address ?? null,
        phonenumber: input.phoneNumber,
        dateofbirth: input.dateOfBirth ?? null,
        preferredpaymentmethod: input.preferredPaymentMethod ?? null,
        bankaccountname: input.bankAccountName ?? null,
        bankaccountnumber: input.bankAccountNumber ?? null,
        bankname: input.bankName ?? null,
        registrationcompleted: true,
        updatedat: new Date().toISOString(),
      },
      { onConflict: "userid" }
    )
    .select("id")
    .maybeSingle();
}

async function upsertCamelProfileTable(userId: number, input: any) {
  return supabaseAdmin
    .from("userProfiles")
    .upsert(
      {
        userId: userId,
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
      },
      { onConflict: "userId" }
    )
    .select("id")
    .maybeSingle();
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let { data: profileRow, error: profileErr } = await upsertLowercaseProfileTable(
      user.id,
      input
    );

    if (profileErr?.code === "PGRST205") {
      ({ data: profileRow, error: profileErr } = await upsertCamelProfileTable(
        user.id,
        input
      ));
    }

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
