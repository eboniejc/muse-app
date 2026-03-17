import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminEnrollments } from "../endpoints/admin/enrollments/list_GET.schema";
import { markLessonComplete } from "../endpoints/admin/lessons/complete_POST.schema";
import { markLessonUncomplete } from "../endpoints/admin/lessons/uncomplete_POST.schema";
import { scheduleLesson } from "../endpoints/admin/lessons/schedule_POST.schema";
import { scheduleEventNotifications } from "../endpoints/admin/events/notify_POST.schema";
import { toast } from "sonner";

export const useAdminEnrollments = (filters?: {
  courseId?: number;
  status?: string;
}) => {
  return useQuery({
    queryKey: ["admin", "enrollments", filters],
    queryFn: async () => {
      const data = await getAdminEnrollments(filters);
      return data.enrollments;
    },
  });
};

export const useMarkLessonComplete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markLessonComplete,
    onSuccess: () => {
      toast.success("Lesson marked as complete");
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] });
      // Invalidate user-facing queries as well to ensure consistency if the user is viewing their own data
      queryClient.invalidateQueries({ queryKey: ["courseEnrollments"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to mark lesson as complete"
      );
    },
  });
};

export const useMarkLessonUncomplete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markLessonUncomplete,
    onSuccess: () => {
      toast.success("Lesson marked as incomplete");
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["courseEnrollments"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to unmark lesson as complete"
      );
    },
  });
};

export const useScheduleLesson = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scheduleLesson,
    onSuccess: () => {
      toast.success("Lesson scheduled — notifications will be sent 24h and 1h before class");
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule lesson"
      );
    },
  });
};

export const useScheduleEventNotifications = () => {
  return useMutation({
    mutationFn: scheduleEventNotifications,
    onSuccess: (data) => {
      if (data.scheduled.length === 0) {
        toast.info("Event is too soon — no future notifications to schedule");
      } else {
        toast.success(`Notifications scheduled: ${data.scheduled.join(", ")} before event`);
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule event notifications"
      );
    },
  });
};