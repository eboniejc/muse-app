import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useAuth } from "../helpers/useAuth";
import { useUpcomingLessons } from "../helpers/useUpcomingLessons";
import { useUpcomingEvents } from "../helpers/useUpcomingEvents";
import { useCourseEnrollments } from "../helpers/useCourseEnrollments";
import { useRoomBookings } from "../helpers/useRoomBookings";
import { useCancelRoomBooking } from "../helpers/useCancelRoomBooking";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/Dialog";
import { Calendar, GraduationCap, ArrowRight, PartyPopper, Trophy, Clock, Tv2, Trash2 } from "lucide-react";
import { useHoursRemaining } from "../helpers/useHoursRemaining";
import { format, startOfDay, isPast } from "date-fns";
import { toast } from "sonner";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = user?.role === "admin";

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null);
  const now = useMemo(() => new Date(), []);

  const { data: lessons, isLoading: lessonsLoading } = useUpcomingLessons();
  const { data: events, isLoading: eventsLoading } = useUpcomingEvents();
  const { data: enrollments, isLoading: enrollmentsLoading } = useCourseEnrollments();
  const { data: hours, refetch: refetchHours } = useHoursRemaining();

  const { data: studioBookings, isLoading: studioLoading, refetch: refetchStudio } = useRoomBookings(
    { mine: true, startDate: now }
  );

  const { mutateAsync: cancelBooking } = useCancelRoomBooking();

  const handleCancelClick = (bookingId: number) => {
    setPendingCancelId(bookingId);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!pendingCancelId) return;
    try {
      await cancelBooking({ bookingId: pendingCancelId });
      toast.success("Studio booking cancelled.");
      setCancelDialogOpen(false);
      setPendingCancelId(null);
      refetchStudio();
      refetchHours();
    } catch {
      toast.error("Failed to cancel booking.");
    }
  };

  const upcomingBookingsCount = lessons?.length || 0;
  const activeCoursesCount = enrollments?.filter(e => e.status === "active").length || 0;

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Dashboard - MUSE INC</title>
      </Helmet>

      <div className={styles.welcome}>
        <h1 className={styles.greeting}>
          {t('dashboard.welcome', { name: user?.displayName })}
        </h1>
        <p className={styles.date}>{format(new Date(), "EEEE, MMMM do, yyyy")}</p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: "var(--primary)" }}>
            <Calendar size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{upcomingBookingsCount}</span>
            <span className={styles.statLabel}>{t('dashboard.upcomingSessions')}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: "var(--secondary)" }}>
            <GraduationCap size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{activeCoursesCount}</span>
            <span className={styles.statLabel}>{t('dashboard.activeCourses')}</span>
          </div>
        </div>
        {hours && (
          <Link to="/schedule" style={{ textDecoration: "none" }}>
            <div className={styles.statCard} style={{ cursor: "pointer" }}>
              <div className={styles.statIcon} style={{ color: hours.remaining === 0 ? "var(--destructive)" : "var(--primary)" }}>
                <Clock size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{hours.remaining}</span>
                <span className={styles.statLabel}>Practice hrs remaining</span>
              </div>
            </div>
          </Link>
        )}
      </div>

      <div className={styles.contentGrid}>
        {/* Upcoming Lessons */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.upcomingSessions')}</h2>
          </div>
          <div className={styles.list}>
            {lessonsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : lessons && lessons.length > 0 ? (
              lessons.slice(0, 3).map((lesson) => (
                <div key={`${lesson.type}-${lesson.id}`} className={styles.listItem}>
                  <div className={styles.dateBox}>
                    <span className={styles.day}>{format(new Date(lesson.scheduledAt), "dd")}</span>
                    <span className={styles.month}>{format(new Date(lesson.scheduledAt), "MMM")}</span>
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemTitle}>
                      {lesson.type === "contest"
                        ? <><Trophy size={14} style={{ display: "inline", marginRight: 4, color: "var(--warning, #f59e0b)" }} />{lesson.courseName} — Module {lesson.moduleNumber} Contest</>
                        : <>{lesson.courseName} - Lesson {lesson.lessonNumber}</>}
                    </h3>
                    <p className={styles.itemSub}>{format(new Date(lesson.scheduledAt), "h:mm a")}</p>
                  </div>
                  <div className={styles.statusIndicator} data-status="confirmed" />
                </div>
              ))
            ) : (
              <div className={styles.emptyState}><p>{t('dashboard.noSessions')}</p></div>
            )}
          </div>
        </div>

        {/* Upcoming Studio Bookings — students only */}
        {!isAdmin && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>My Studio Bookings</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/schedule">Book a room <ArrowRight size={16} /></Link>
              </Button>
            </div>
            <div className={styles.list}>
              {studioLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : studioBookings && studioBookings.length > 0 ? (
                studioBookings.slice(0, 5).map((booking) => {
                  const isCancelled = booking.status === "cancelled";
                  const started = isPast(new Date(booking.startTime));
                  return (
                    <div key={booking.id} className={styles.listItem} style={{ opacity: isCancelled ? 0.6 : 1 }}>
                      <div className={styles.dateBox}>
                        <span className={styles.day}>{format(new Date(booking.startTime), "dd")}</span>
                        <span className={styles.month}>{format(new Date(booking.startTime), "MMM")}</span>
                      </div>
                      <div className={styles.itemDetails}>
                        <h3 className={styles.itemTitle}>
                          <Tv2 size={14} style={{ display: "inline", marginRight: 4 }} />
                          {booking.roomName}
                        </h3>
                        <p className={styles.itemSub}>
                          {format(new Date(booking.startTime), "h:mm a")} – {format(new Date(booking.endTime), "h:mm a")}
                        </p>
                      </div>
                      {isCancelled ? (
                        <span style={{ fontSize: "0.75rem", color: "var(--destructive)", fontWeight: 600, whiteSpace: "nowrap" }}>
                          Cancelled
                        </span>
                      ) : !started ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          style={{ color: "var(--muted-foreground)" }}
                          onClick={() => handleCancelClick(booking.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyState}><p>No upcoming studio bookings.</p></div>
              )}
            </div>
          </div>
        )}

        {/* Course Progress */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.myCourses')}</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/courses">{t('courses.browseCatalog')} <ArrowRight size={16} /></Link>
            </Button>
          </div>
          <div className={styles.list}>
            {enrollmentsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : enrollments && enrollments.length > 0 ? (
              enrollments.slice(0, 3).map((enrollment) => (
                <div key={enrollment.id} className={styles.listItem}>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemTitle}>{enrollment.courseName}</h3>
                    <p className={styles.itemSub}>
                      {t('admin.status')}: {t(`admin.${enrollment.status}`)}
                    </p>
                  </div>
                  <div className={styles.statusIndicator} data-status={enrollment.status} />
                </div>
              ))
            ) : (
              <div className={styles.emptyState}><p>{t('dashboard.noCourses')}</p></div>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t("dashboard.upcomingEvents")}</h2>
          </div>
          <div className={styles.list}>
            {eventsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : events && events.length > 0 ? (
              events.slice(0, 3).map((event) => (
                <div key={event.id} className={styles.listItem}>
                  {event.flyerUrl ? (
                    <img src={event.flyerUrl} alt={`${event.title} flyer`} className={styles.eventFlyer} loading="lazy" />
                  ) : null}
                  <div className={styles.dateBox}>
                    <span className={styles.day}>{format(new Date(event.startAt), "dd")}</span>
                    <span className={styles.month}>{format(new Date(event.startAt), "MMM")}</span>
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemTitle}>{event.title}</h3>
                    <p className={styles.itemSub}>
                      {format(new Date(event.startAt), "h:mm a")}
                      {event.endAt ? ` - ${format(new Date(event.endAt), "h:mm a")}` : ""}
                    </p>
                    {event.caption ? <p className={styles.eventCaption}>{event.caption}</p> : null}
                  </div>
                  <PartyPopper size={16} className={styles.eventIcon} />
                </div>
              ))
            ) : (
              <div className={styles.emptyState}><p>{t("dashboard.noEvents")}</p></div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Studio Booking</DialogTitle>
            <DialogDescription>Are you sure you want to cancel this studio booking? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>Keep it</Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>Cancel Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
