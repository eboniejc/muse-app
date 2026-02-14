import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelRoomBooking } from "../endpoints/rooms/bookings/cancel_POST.schema";

export const useCancelRoomBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelRoomBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roomBookings"] });
    },
  });
};