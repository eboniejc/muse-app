import { useQuery } from "@tanstack/react-query";
import { getRoomBookings, schema } from "../endpoints/rooms/bookings/list_GET.schema";
import { z } from "zod";

export const useRoomBookings = (params: z.infer<typeof schema> = {}) => {
  return useQuery({
    queryKey: ["roomBookings", "list", params],
    queryFn: async () => {
      const data = await getRoomBookings(params);
      return data.bookings;
    },
  });
};