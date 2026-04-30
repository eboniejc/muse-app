import { useQuery } from "@tanstack/react-query";
import { getHoursRemaining } from "../endpoints/rooms/bookings/hours_GET.schema";

export const useHoursRemaining = () => {
  return useQuery({
    queryKey: ["rooms", "hours"],
    queryFn: () => getHoursRemaining(),
  });
};
