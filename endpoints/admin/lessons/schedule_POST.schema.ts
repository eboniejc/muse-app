import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  enrollmentId: z.number().int(),
  lessonNumber: z.number().int(),
  scheduledAt: z.date(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  scheduleId: number;
};

export const scheduleLesson = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/admin/lessons/schedule", {
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
