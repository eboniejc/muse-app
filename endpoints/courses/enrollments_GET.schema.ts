import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseEnrollments } from "../../helpers/schema";

export const schema = z.object({});

export type EnrollmentWithCourse = Pick<
  Selectable<CourseEnrollments>,
  "id" | "status" | "progressPercentage" | "enrolledAt" | "completedAt" | "courseId"
> & {
  courseName: string;
  courseDescription: string | null;
  totalLessons: number;
  completedLessons: number;
  instructorName: string | null;
};

export type OutputType = {
  enrollments: EnrollmentWithCourse[];
};

export const getCourseEnrollments = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/courses/enrollments`, {
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