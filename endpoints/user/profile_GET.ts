import { supabaseAdmin } from "../../helpers/supabaseServer";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./profile_GET.schema";

function readField<T = unknown>(row: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] !== undefined) {
      return row[key] as T;
    }
  }
  return undefined;
}

async function fetchProfileRow(userId: number) {
  const lower = await supabaseAdmin
    .from("userprofiles")
    .select("*")
    .eq("userid", userId)
    .limit(1)
    .maybeSingle();

  if (!lower.error || lower.error.code !== "PGRST205") {
    return lower;
  }

  return supabaseAdmin
    .from("userProfiles")
    .select("*")
    .eq("userId", userId)
    .limit(1)
    .maybeSingle();
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const { data: userRec, error: userErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!userRec) {
      return new Response(
        superjson.stringify({ error: "User not found" }),
        { status: 404 }
      );
    }

    const { data: profileRow, error: profileErr } = await fetchProfileRow(user.id);
    if (profileErr && profileErr.code !== "PGRST116") {
      throw profileErr;
    }

    const profile = {
      userId: userRec.id,
      email: userRec.email,
      displayName: readField<string>(userRec, "displayName", "displayname"),
      avatarUrl: readField<string | null>(userRec, "avatarUrl", "avatarurl") ?? null,
      role: userRec.role,
      whatsappNumber: readField<string | null>(userRec, "whatsappNumber", "whatsappnumber") ?? null,
      fullName: readField<string | null>(profileRow ?? {}, "fullName", "fullname") ?? null,
      gender: readField<string | null>(profileRow ?? {}, "gender") ?? null,
      address: readField<string | null>(profileRow ?? {}, "address") ?? null,
      phoneNumber: readField<string | null>(profileRow ?? {}, "phoneNumber", "phonenumber") ?? null,
      dateOfBirth: readField<string | null>(profileRow ?? {}, "dateOfBirth", "dateofbirth") ?? null,
      preferredPaymentMethod:
        readField<string | null>(profileRow ?? {}, "preferredPaymentMethod", "preferredpaymentmethod") ?? null,
      bankAccountName:
        readField<string | null>(profileRow ?? {}, "bankAccountName", "bankaccountname") ?? null,
      bankAccountNumber:
        readField<string | null>(profileRow ?? {}, "bankAccountNumber", "bankaccountnumber") ?? null,
      bankName: readField<string | null>(profileRow ?? {}, "bankName", "bankname") ?? null,
      registrationCompleted:
        readField<boolean | null>(profileRow ?? {}, "registrationCompleted", "registrationcompleted") ?? false,
    };

    return new Response(
      superjson.stringify({
        profile: {
          ...profile
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
