import { z } from "zod";
import superjson from "superjson";

export type OutputType = {
  used: number;
  total: number;
  remaining: number;
};

export const getHoursRemaining = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/rooms/bookings/hours`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
