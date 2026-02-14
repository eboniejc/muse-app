import { useQuery } from "@tanstack/react-query";
import { getInstructors } from "../endpoints/instructors/list_GET.schema";

export const useInstructors = () => {
  return useQuery({
    queryKey: ["instructors", "list"],
    queryFn: async () => {
      const data = await getInstructors();
      return data.instructors;
    },
  });
};