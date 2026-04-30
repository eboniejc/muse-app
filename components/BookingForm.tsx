import React from "react";
import { z } from "zod";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from "./Form";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useCreateRoomBooking } from "../helpers/useCreateRoomBooking";
import { toast } from "sonner";
import { addHours, format, setHours, setMinutes } from "date-fns";

const bookingSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  notes: z.string().optional(),
});

interface BookingFormProps {
  roomId: number;
  date: Date;
  onSuccess: () => void;
  targetUserId?: number;
}

export const BookingForm: React.FC<BookingFormProps> = ({ roomId, date, onSuccess, targetUserId }) => {
  const { mutateAsync: createBooking, isPending } = useCreateRoomBooking();

  const form = useForm({
    schema: bookingSchema,
    defaultValues: {
      startTime: "09:00",
      notes: "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof bookingSchema>) => {
    try {
      const [hours, minutes] = values.startTime.split(":").map(Number);
      const startDate = setMinutes(setHours(date, hours), minutes);
      const endDate = addHours(startDate, 1);

      await createBooking({
        roomId,
        startTime: startDate,
        endTime: endDate,
        notes: values.notes,
        targetUserId,
      } as any);

      toast.success("Room booked successfully!");
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to book room. Please try again.");
      console.error(error);
    }
  };

  // 9am (09:00) through 8pm (20:00) — each slot is 1 hour, last ends at 9pm
  const timeSlots = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 9;
    return `${hour.toString().padStart(2, "0")}:00`;
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
        <FormItem name="startTime">
          <FormLabel>Start Time (1 hour session)</FormLabel>
          <Select
            onValueChange={(val) => form.setValues(prev => ({ ...prev, startTime: val }))}
            defaultValue={form.values.startTime}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {timeSlots.map((time) => (
                <SelectItem key={time} value={time}>
                  {time} – {(parseInt(time) + 1).toString().padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>

        <FormItem name="notes">
          <FormLabel>Notes (Optional)</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Any specific notes?"
              value={form.values.notes}
              onChange={(e) => form.setValues(prev => ({ ...prev, notes: e.target.value }))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <Button type="submit" disabled={isPending} style={{ width: "100%" }}>
          {isPending ? "Booking..." : `Book for ${format(date, "MMM d")}`}
        </Button>
      </form>
    </Form>
  );
};
