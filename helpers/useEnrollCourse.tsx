import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollCourse } from "../endpoints/courses/enroll_POST.schema";

export const useEnrollCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enrollCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseEnrollments"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] }); // Update counts
    },
  });
};