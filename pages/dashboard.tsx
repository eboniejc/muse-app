import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../helpers/useAuth";
import { useUpcomingLessons } from "../helpers/useUpcomingLessons";
import { useCourseEnrollments } from "../helpers/useCourseEnrollments";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Calendar, GraduationCap, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  
  const { data: lessons, isLoading: lessonsLoading } = useUpcomingLessons();
  
  const { data: enrollments, isLoading: enrollmentsLoading } = useCourseEnrollments();

  // Calculate stats
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
            {lessonsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : lessons && lessons.length > 0 ? (
              lessons.slice(0, 3).map((lesson) => (
                <div key={lesson.id} className={styles.listItem}>
                  <div className={styles.dateBox}>
                    <span className={styles.day}>{format(new Date(lesson.scheduledAt), "dd")}</span>
                    <span className={styles.month}>{format(new Date(lesson.scheduledAt), "MMM")}</span>
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemTitle}>
                      {lesson.courseName} - Lesson {lesson.lessonNumber}
                    </h3>
                    <p className={styles.itemSub}>
                      {format(new Date(lesson.scheduledAt), "h:mm a")}
                    </p>
                  </div>
                  <div className={styles.statusIndicator} data-status="confirmed" />
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
                    <p className={styles.itemSub}>
                      Status: {enrollment.status}
                    </p>
                  </div>
                  <div className={styles.statusIndicator} data-status="confirmed" />
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
