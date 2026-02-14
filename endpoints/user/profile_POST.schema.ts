import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  gender: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.date().nullable().optional(),
  preferredPaymentMethod: z.string().nullable().optional(),
  bankAccountName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  profileId: number;
};

export const postUserProfile = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/user/profile`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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