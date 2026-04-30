import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { RoomList } from "../components/RoomList";
import { BookingForm } from "../components/BookingForm";
import { Calendar } from "../components/Calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/Dialog";
import { Button } from "../components/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { useRoomBookings } from "../helpers/useRoomBookings";
import { useCancelRoomBooking } from "../helpers/useCancelRoomBooking";
import { useHoursRemaining } from "../helpers/useHoursRemaining";
import { useAuth } from "../helpers/useAuth";
import { useUsers } from "../helpers/useUsers";
import { format, isSameDay, startOfDay } from "date-fns";
import { Trash2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import styles from "./schedule.module.css";

export default function SchedulePage() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = user?.role === "admin";

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null);
  const [targetUserId, setTargetUserId] = useState<number | undefined>(undefined);

  const { data: bookings, refetch } = useRoomBookings({
    roomId: selectedRoomId || undefined,
    startDate: startOfDay(new Date()),
  });
  const { data: hours, refetch: refetchHours } = useHoursRemaining();
  const { data: users } = useUsers();

  const { mutateAsync: cancelBooking } = useCancelRoomBooking();

  const handleCancel = (bookingId: number) => {
    setPendingCancelId(bookingId);
    setIsCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!pendingCancelId) return;
    try {
      await cancelBooking({ bookingId: pendingCancelId });
      toast.success(t("schedule.bookingCancelled"));
      setIsCancelDialogOpen(false);
      setPendingCancelId(null);
      refetch();
      refetchHours();
    } catch {
      toast.error(t("schedule.cancelError"));
    }
  };

  // Exclude cancelled bookings from the schedule view
  const dailyBookings = bookings?.filter(
    (b) => selectedDate && isSameDay(new Date(b.startTime), selectedDate) && b.status !== "cancelled"
  );

  const atLimit = hours && hours.remaining === 0;

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Schedule Studio - MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>{t("schedule.studioSchedule")}</h1>
        <p className={styles.subtitle}>{t("schedule.subtitle")}</p>
      </div>

      {/* Hours banner — students only */}
      {!isAdmin && hours && (
        <div className={`${styles.hoursBanner} ${atLimit ? styles.hoursBannerWarning : ""}`}>
          {atLimit ? (
            <>
              <AlertCircle size={16} />
              <span>You have used all {hours.total} practice hours for this 6-week period.</span>
            </>
          ) : (
            <>
              <Clock size={16} />
              <span>
                {hours.used} of {hours.total} practice hours used · <strong>{hours.remaining} remaining</strong> this period
              </span>
            </>
          )}
        </div>
      )}

      {/* Admin: book for a student */}
      {isAdmin && users && (
        <div className={styles.adminPicker}>
          <span className={styles.adminPickerLabel}>Book for student:</span>
          <Select
            value={targetUserId ? String(targetUserId) : "self"}
            onValueChange={(val) => setTargetUserId(val === "self" ? undefined : Number(val))}
          >
            <SelectTrigger style={{ width: 260 }}>
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self">— Admin (no student) —</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.displayName ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className={styles.layout}>
        {/* Left Panel: Room List */}
        <div className={styles.sidebar}>
          <h2 className={styles.sectionTitle}>{t("schedule.selectRoom")}</h2>
          <RoomList selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
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
                      <Button disabled={!isAdmin && !!atLimit}>
                        {t("schedule.bookSlot")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("schedule.bookSession")}</DialogTitle>
                      </DialogHeader>
                      <BookingForm
                        roomId={selectedRoomId}
                        date={selectedDate}
                        targetUserId={targetUserId}
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
                  <div className={styles.emptyState}>{t("schedule.selectRoomFirst")}</div>
                ) : dailyBookings && dailyBookings.length > 0 ? (
                  dailyBookings.map((booking) => (
                    <div key={booking.id} className={styles.bookingCard}>
                      <div className={styles.bookingTime}>
                        <Clock size={14} />
                        {format(new Date(booking.startTime), "HH:mm")} -{" "}
                        {format(new Date(booking.endTime), "HH:mm")}
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
                  <div className={styles.emptyState}>{t("schedule.noBookings")}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("schedule.cancelBooking")}</DialogTitle>
            <DialogDescription>{t("schedule.cancelConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCancelDialogOpen(false)}>
              {t("schedule.keep")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              {t("schedule.cancelBooking")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
