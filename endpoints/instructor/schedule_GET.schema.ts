import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InstructorLesson = {
  id: number;
  enrollmentId: number;
  lessonNumber: number;
  scheduledAt: Date;
  courseName: string;
  studentName: string;
  studentEmail: string;
  ebookTitle: string | null;
  ebookUrl: string | null;
  ebookUnlocked: boolean;
};

export type OutputType = {
  lessons: InstructorLesson[];
};

export const getInstructorSchedule = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch("/_api/instructor/schedule", {
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
