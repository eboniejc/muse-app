import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseEnrollments } from "../../helpers/schema";

export const schema = z.object({
  courseId: z.number(),
});

export type OutputType = {
  enrollment: Selectable<CourseEnrollments>;
};

export const enrollCourse = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/courses/enroll`, {
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