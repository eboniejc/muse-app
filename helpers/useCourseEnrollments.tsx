import { useQuery } from "@tanstack/react-query";
import { getCourseEnrollments } from "../endpoints/courses/enrollments_GET.schema";

export const useCourseEnrollments = () => {
  return useQuery({
    queryKey: ["courseEnrollments", "list"],
    queryFn: async () => {
      const data = await getCourseEnrollments();
      return data.enrollments;
    },
  });
};