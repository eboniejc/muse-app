import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Ebooks } from "../../helpers/schema";

export const schema = z.object({});

export type EbookWithStatus = Pick<
  Selectable<Ebooks>,
  | "id"
  | "title"
  | "titleVi"
  | "description"
  | "descriptionVi"
  | "coverImageUrl"
  | "fileUrl"
  | "courseId"
  | "sortOrder"
> & {
  courseName: string | null;
  isUnlocked: boolean;
};

export type OutputType = {
  ebooks: EbookWithStatus[];
};

export const getEbooks = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/ebooks/list`, {
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