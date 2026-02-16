import { z } from "zod";

// We use z.any() for rows because the structure depends on the table being imported.
// In a real strict environment we might want discriminated unions, but for Sheets generic import, 
// loose typing for rows combined with DB schema validation is pragmatic.
export const schema = z.object({
  table: z.enum([
    "courses",
    "ebooks",
    "rooms",
    "roomBookings",
    "courseEnrollments",
    "lessonCompletions",
    "lessonSchedules",
    "users",
    "userProfiles",
  ]),
  rows: z.array(z.record(z.any())),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  count: number;
  message?: string;
};
