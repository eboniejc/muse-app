import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  enrollmentId: z.number(),
  lessonNumber: z.number(),
});

export type OutputType = {
  success: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercentage: number;
};

export const markLessonUncomplete = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/lessons/uncomplete`, {
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