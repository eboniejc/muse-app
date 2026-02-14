import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { RoomBookings } from "../../../helpers/schema";

export const schema = z.object({
  roomId: z.number().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export type BookingWithDetails = Pick<
  Selectable<RoomBookings>,
  "id" | "startTime" | "endTime" | "status" | "notes" | "roomId" | "userId"
> & {
  roomName: string;
  userName: string;
  userEmail: string;
};

export type OutputType = {
  bookings: BookingWithDetails[];
};

export const getRoomBookings = async (
  params: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  if (params.roomId) searchParams.set("roomId", params.roomId.toString());
  if (params.startDate)
    searchParams.set("startDate", params.startDate.toISOString());
  if (params.endDate)
    searchParams.set("endDate", params.endDate.toISOString());

  const result = await fetch(`/_api/rooms/bookings/list?${searchParams.toString()}`, {
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