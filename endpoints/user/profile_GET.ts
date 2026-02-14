import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./profile_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Fetch user profile and basic user info
    const profile = await db
      .selectFrom("users")
      .leftJoin("userProfiles", "users.id", "userProfiles.userId")
      .select([
        "users.id as userId",
        "users.email",
        "users.displayName",
        "users.avatarUrl",
        "users.role",
        "users.whatsappNumber",
        // Profile fields
        "userProfiles.fullName",
        "userProfiles.gender",
        "userProfiles.address",
        "userProfiles.phoneNumber",
        "userProfiles.dateOfBirth",
        "userProfiles.preferredPaymentMethod",
        "userProfiles.bankAccountName",
        "userProfiles.bankAccountNumber",
        "userProfiles.bankName",
        "userProfiles.registrationCompleted",
      ])
      .where("users.id", "=", user.id)
      .executeTakeFirst();

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