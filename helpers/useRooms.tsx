import { useQuery } from "@tanstack/react-query";
import { getRooms } from "../endpoints/rooms/list_GET.schema";

export const useRooms = () => {
  return useQuery({
    queryKey: ["rooms", "list"],
    queryFn: async () => {
      const data = await getRooms();
      return data.rooms;
    },
  });
};