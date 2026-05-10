import { useQuery } from "@tanstack/react-query";
import { getUpcomingLessons } from "../endpoints/lessons/upcoming_GET.schema";

export const useUpcomingLessons = () => {
  return useQuery({
    queryKey: ["lessons", "upcoming"],
    queryFn: async () => {
      const data = await getUpcomingLessons();
      return data.lessons;
    },
  });
};

