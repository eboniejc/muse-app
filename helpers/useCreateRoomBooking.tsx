import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRoomBooking } from "../endpoints/rooms/bookings/create_POST.schema";

export const useCreateRoomBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRoomBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roomBookings"] });
    },
  });
};