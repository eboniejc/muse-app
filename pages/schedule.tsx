import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { RoomList } from "../components/RoomList";
import { BookingForm } from "../components/BookingForm";
import { Calendar } from "../components/Calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/Dialog";
import { Button } from "../components/Button";
import { useRoomBookings } from "../helpers/useRoomBookings";
import { useCancelRoomBooking } from "../helpers/useCancelRoomBooking";
import { format, isSameDay } from "date-fns";
import { Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import styles from "./schedule.module.css";

export default function SchedulePage() {
  const { t } = useTranslation();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);

  const { data: bookings, refetch } = useRoomBookings({
    roomId: selectedRoomId || undefined,
    startDate: new Date(), // Only fetch future bookings
  });

  const { mutateAsync: cancelBooking } = useCancelRoomBooking();

  const handleCancel = async (bookingId: number) => {
    if (confirm(t('schedule.cancelConfirm'))) {
      try {
        await cancelBooking({ bookingId });
        toast.success(t('schedule.bookingCancelled'));
      } catch (error) {
        toast.error(t('schedule.cancelError'));
      }
    }
  };

  // Filter bookings for the selected date to show in the daily view
  const dailyBookings = bookings?.filter(b => 
    selectedDate && isSameDay(new Date(b.startTime), selectedDate)
  );

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Schedule Studio - MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>{t('schedule.studioSchedule')}</h1>
        <p className={styles.subtitle}>{t('schedule.subtitle')}</p>
      </div>

      <div className={styles.layout}>
        {/* Left Panel: Room List */}
        <div className={styles.sidebar}>
          <h2 className={styles.sectionTitle}>{t('schedule.selectRoom')}</h2>
          <RoomList 
            selectedRoomId={selectedRoomId} 
            onSelectRoom={setSelectedRoomId} 
          />
        </div>

        {/* Right Panel: Calendar & Slots */}
        <div className={styles.main}>
          <div className={styles.calendarSection}>
            <div className={styles.calendarWrapper}>
              <Calendar 
                mode="single" 
                selected={selectedDate} 
                onSelect={setSelectedDate}
                className={styles.calendar}
                disabled={{ before: new Date() }}
              />
            </div>
            
            <div className={styles.dayView}>
              <div className={styles.dayHeader}>
                <h3>{selectedDate ? format(selectedDate, "MMMM do") : "Select a date"}</h3>
                {selectedRoomId && selectedDate && (
                  <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>{t('schedule.bookSlot')}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('schedule.bookSession')}</DialogTitle>
                      </DialogHeader>
                      <BookingForm 
                        roomId={selectedRoomId} 
                        date={selectedDate} 
                        onSuccess={() => {
                          setIsBookingDialogOpen(false);
                          refetch();
                        }} 
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className={styles.bookingsList}>
                {!selectedRoomId ? (
                  <div className={styles.emptyState}>{t('schedule.selectRoomFirst')}</div>
                ) : dailyBookings && dailyBookings.length > 0 ? (
                  dailyBookings.map(booking => (
                    <div key={booking.id} className={styles.bookingCard}>
                      <div className={styles.bookingTime}>
                        <Clock size={14} />
                        {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                      </div>
                      <div className={styles.bookingInfo}>
                        <span className={styles.bookingUser}>{booking.userName}</span>
                        {booking.status === "confirmed" && (
                          <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            className={styles.cancelBtn}
                            onClick={() => handleCancel(booking.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>{t('schedule.noBookings')}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}