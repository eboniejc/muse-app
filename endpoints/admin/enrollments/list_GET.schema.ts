import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  courseId: z.number().optional(),
  status: z.string().optional(),
});

export type AdminEnrollment = {
  id: number;
  courseId: number;
  courseName: string;
  totalLessons: number;
  skillLevel: string | null;
  userId: number;
  studentName: string;
  studentEmail: string;
  status: string;
  enrolledAt: Date;
  completedAt: Date | null;
  progressPercentage: number;
  completedLessons: number;
  lessonCompletions: { lessonNumber: number; completedAt: Date }[];
};

export type OutputType = {
  enrollments: AdminEnrollment[];
};

export const getAdminEnrollments = async (
  query?: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const queryString = query
    ? "?" +
      new URLSearchParams(
        Object.entries(query).reduce((acc, [key, val]) => {
          if (val !== undefined) acc[key] = String(val);
          return acc;
        }, {} as Record<string, string>)
      ).toString()
    : "";

  const result = await fetch(`/_api/admin/enrollments/list${queryString}`, {
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