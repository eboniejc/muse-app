import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../helpers/useAuth";
import { useRoomBookings } from "../helpers/useRoomBookings";
import { useCourseEnrollments } from "../helpers/useCourseEnrollments";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Calendar, Clock, GraduationCap, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  
  const { data: bookings, isLoading: bookingsLoading } = useRoomBookings({
    startDate: new Date(), // Fetch bookings from today onwards
  });
  
  const { data: enrollments, isLoading: enrollmentsLoading } = useCourseEnrollments();

  // Calculate stats
  const upcomingBookingsCount = bookings?.filter(b => b.status === "confirmed").length || 0;
  const activeCoursesCount = enrollments?.filter(e => e.status === "active").length || 0;
  
  // Mock practice hours (since we don't have historical data API easily available in this context)
  const practiceHours = 12; 

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Dashboard - DJ School</title>
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
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: "var(--accent)" }}>
            <Clock size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{practiceHours}h</span>
            <span className={styles.statLabel}>{t('dashboard.practiceTime')}</span>
          </div>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* Upcoming Bookings */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.upcomingSessions')}</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/schedule">{t('schedule.title')} <ArrowRight size={16} /></Link>
            </Button>
          </div>
          
          <div className={styles.list}>
            {bookingsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : bookings && bookings.length > 0 ? (
              bookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className={styles.listItem}>
                  <div className={styles.dateBox}>
                    <span className={styles.day}>{format(new Date(booking.startTime), "dd")}</span>
                    <span className={styles.month}>{format(new Date(booking.startTime), "MMM")}</span>
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemTitle}>{booking.roomName}</h3>
                    <p className={styles.itemSub}>
                      {format(new Date(booking.startTime), "h:mm a")} - {format(new Date(booking.endTime), "h:mm a")}
                    </p>
                  </div>
                  <div className={styles.statusIndicator} data-status={booking.status} />
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <p>{t('dashboard.noSessions')}</p>
              </div>
            )}
          </div>
        </div>

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
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill} 
                        style={{ width: `${enrollment.progressPercentage || 0}%` }} 
                      />
                    </div>
                  </div>
                  <span className={styles.percentage}>{enrollment.progressPercentage || 0}%</span>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <p>{t('dashboard.noCourses')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}