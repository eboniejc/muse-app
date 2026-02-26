import { z } from "zod";

export const schema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  gender: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().nullable().optional(),
  preferredPaymentMethod: z.string().nullable().optional(),
  bankAccountName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  selectedCourseId: z.number().nullable().optional(),
  courseName: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

