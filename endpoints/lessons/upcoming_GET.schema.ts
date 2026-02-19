import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type UpcomingLesson = {
  id: number;
  enrollmentId: number;
  courseId: number | null;
  courseName: string;
  lessonNumber: number;
  scheduledAt: Date | string;
};

export type OutputType = {
  lessons: UpcomingLesson[];
};

export const getUpcomingLessons = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/lessons/upcoming`, {
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

