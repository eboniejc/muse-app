import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type UpcomingEvent = {
  id: number;
  title: string;
  caption: string | null;
  flyerUrl: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
};

export type OutputType = {
  events: UpcomingEvent[];
};

export const getUpcomingEvents = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/events/upcoming`, {
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

