import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  eventId: z.number().int(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  scheduled: string[]; // Which notifications were scheduled: "24h" | "1h"
};

export const scheduleEventNotifications = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/admin/events/notify", {
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
