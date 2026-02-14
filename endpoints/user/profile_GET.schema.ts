import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { UserProfiles, Users } from "../../helpers/schema";

export const schema = z.object({});

export type UserProfileData = Pick<
  Selectable<Users>,
  "email" | "displayName" | "avatarUrl" | "role" | "whatsappNumber"
> &
  Partial<
    Pick<
      Selectable<UserProfiles>,
      | "fullName"
      | "gender"
      | "address"
      | "phoneNumber"
      | "dateOfBirth"
      | "preferredPaymentMethod"
      | "bankAccountName"
      | "bankAccountNumber"
      | "bankName"
      | "registrationCompleted"
    >
  > & {
    userId: number;
  };

export type OutputType = {
  profile: UserProfileData;
};

export const getUserProfile = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/user/profile`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};