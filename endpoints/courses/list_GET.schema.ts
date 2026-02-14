import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses } from "../../helpers/schema";

export const schema = z.object({});

export type CourseWithDetails = Pick<
  Selectable<Courses>,
  | "id"
  | "name"
  | "description"
  | "totalLessons"
  | "maxStudents"
  | "skillLevel"
  | "isActive"
  | "instructorId"
> & {
  price: string | null;
  instructorName: string | null;
  instructorAvatar: string | null;
  enrolledCount: number;
};

export type OutputType = {
  courses: CourseWithDetails[];
};

export const getCourses = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/courses/list`, {
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