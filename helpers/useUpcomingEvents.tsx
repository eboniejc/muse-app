import { useQuery } from "@tanstack/react-query";
import { getUpcomingEvents } from "../endpoints/events/upcoming_GET.schema";

export const useUpcomingEvents = () => {
  return useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: async () => {
      const data = await getUpcomingEvents();
      return data.events;
    },
  });
};

