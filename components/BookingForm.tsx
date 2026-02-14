import React from "react";
import { z } from "zod";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useCreateRoomBooking } from "../helpers/useCreateRoomBooking";
import { toast } from "sonner";
import { addHours, format, setHours, setMinutes, startOfHour } from "date-fns";

const bookingSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  duration: z.string().min(1, "Duration is required"),
  notes: z.string().optional(),
});

interface BookingFormProps {
  roomId: number;
  date: Date;
  onSuccess: () => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({ roomId, date, onSuccess }) => {
  const { mutateAsync: createBooking, isPending } = useCreateRoomBooking();

  const form = useForm({
    schema: bookingSchema,
    defaultValues: {
      startTime: "12:00",
      duration: "1",
      notes: "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof bookingSchema>) => {
    try {
      const [hours, minutes] = values.startTime.split(":").map(Number);
      const startDate = setMinutes(setHours(date, hours), minutes);
      const endDate = addHours(startDate, parseInt(values.duration));

      await createBooking({
        roomId,
        startTime: startDate,
        endTime: endDate,
        notes: values.notes,
      });

      toast.success("Room booked successfully!");
      onSuccess();
    } catch (error) {
      toast.error("Failed to book room. Please try again.");
      console.error(error);
    }
  };

  // Generate time slots (10 AM to 10 PM)
  const timeSlots = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 10;
    return `${hour.toString().padStart(2, "0")}:00`;
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
        <div style={{ display: "flex", gap: "var(--spacing-4)" }}>
          <div style={{ flex: 1 }}>
            <FormItem name="startTime">
              <FormLabel>Start Time</FormLabel>
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
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </div>
          <div style={{ flex: 1 }}>
            <FormItem name="duration">
              <FormLabel>Duration (Hours)</FormLabel>
              <Select 
                onValueChange={(val) => form.setValues(prev => ({ ...prev, duration: val }))}
                defaultValue={form.values.duration}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Duration" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1">1 Hour</SelectItem>
                  <SelectItem value="2">2 Hours</SelectItem>
                  <SelectItem value="3">3 Hours</SelectItem>
                  <SelectItem value="4">4 Hours</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </div>
        </div>

        <FormItem name="notes">
          <FormLabel>Notes (Optional)</FormLabel>
          <FormControl>
            <Textarea 
              placeholder="Any specific equipment needs?" 
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