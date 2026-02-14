import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Rooms } from "../../helpers/schema";

export const schema = z.object({});

export type Room = Pick<
  Selectable<Rooms>,
  "id" | "name" | "description" | "roomType" | "capacity" | "equipment" | "isActive"
> & {
  hourlyRate: string | null;
};

export type OutputType = {
  rooms: Room[];
};

export const getRooms = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/rooms/list`, {
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