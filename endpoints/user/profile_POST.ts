import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { schema, OutputType } from "./profile_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Upsert user profile
    // We use onConflict to handle both create and update scenarios
    const result = await db
      .insertInto("userProfiles")
      .values({
        userId: user.id,
        fullName: input.fullName,
        gender: input.gender,
        address: input.address,
        phoneNumber: input.phoneNumber,
        dateOfBirth: input.dateOfBirth,
        preferredPaymentMethod: input.preferredPaymentMethod,
        bankAccountName: input.bankAccountName,
        bankAccountNumber: input.bankAccountNumber,
        bankName: input.bankName,
        registrationCompleted: true,
        updatedAt: new Date(),
      })
      .onConflict((oc) =>
        oc.column("userId").doUpdateSet({
          fullName: input.fullName,
          gender: input.gender,
          address: input.address,
          phoneNumber: input.phoneNumber,
          dateOfBirth: input.dateOfBirth,
          preferredPaymentMethod: input.preferredPaymentMethod,
          bankAccountName: input.bankAccountName,
          bankAccountNumber: input.bankAccountNumber,
          bankName: input.bankName,
          registrationCompleted: true,
          updatedAt: new Date(),
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        success: true,
        profileId: result.id,
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