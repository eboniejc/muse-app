import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { RoomBookings } from "../../../helpers/schema";

export const schema = z.object({
  roomId: z.number(),
  startTime: z.date(),
  endTime: z.date(),
  notes: z.string().optional(),
});

export type OutputType = {
  booking: Selectable<RoomBookings>;
};

export const createRoomBooking = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/rooms/bookings/create`, {
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