import { useQuery } from "@tanstack/react-query";
import { getCourses } from "../endpoints/courses/list_GET.schema";

export const useCourses = () => {
  return useQuery({
    queryKey: ["courses", "list"],
    queryFn: async () => {
      const data = await getCourses();
      return data.courses;
    },
  });
};