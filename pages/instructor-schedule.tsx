import React from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow, startOfDay } from "date-fns";
import { CalendarDays, BookOpen, Lock, Unlock } from "lucide-react";
import { getInstructorSchedule } from "../endpoints/instructor/schedule_GET.schema";
import styles from "./instructor-schedule.module.css";

export default function InstructorSchedulePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["instructor", "schedule"],
    queryFn: () => getInstructorSchedule(),
  });

  const lessons = data?.lessons ?? [];

  // Group lessons by calendar day
  const grouped = lessons.reduce<Record<string, typeof lessons>>((acc, lesson) => {
    const key = startOfDay(new Date(lesson.scheduledAt)).toISOString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(lesson);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort();

  function dayHeading(isoDay: string) {
    const d = new Date(isoDay);
    if (isToday(d)) return `Today — ${format(d, "EEEE, MMMM d")}`;
    if (isTomorrow(d)) return `Tomorrow — ${format(d, "EEEE, MMMM d")}`;
    return format(d, "EEEE, MMMM d, yyyy");
  }

  return (
    <div className={styles.container}>
      <Helmet>
        <title>My Schedule — MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>My Schedule</h1>
        <p className={styles.subtitle}>Your upcoming lessons</p>
      </div>

      {isLoading ? null : sortedDays.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <CalendarDays size={48} />
          </div>
          <p>No lessons scheduled yet.</p>
          <p>Lessons will appear here once the admin schedules them.</p>
        </div>
      ) : (
        sortedDays.map((dayKey) => (
          <div key={dayKey} className={styles.dayGroup}>
            <div className={styles.dayLabel}>{dayHeading(dayKey)}</div>
            {grouped[dayKey].map((lesson) => (
              <div key={lesson.id} className={styles.lessonCard}>
                <div className={styles.timeCol}>
                  <div className={styles.time}>
                    {format(new Date(lesson.scheduledAt), "h:mm a")}
                  </div>
                  <div className={styles.lessonNum}>Lesson {lesson.lessonNumber}</div>
                </div>
                <div className={styles.infoCol}>
                  <div className={styles.studentName}>{lesson.studentName}</div>
                  <div className={styles.courseName}>{lesson.courseName}</div>
                  {lesson.ebookTitle && (
                    <div className={styles.ebookRow}>
                      <BookOpen size={13} />
                      <span>{lesson.ebookTitle}</span>
                      {lesson.ebookUnlocked ? (
                        <span className={styles.ebookUnlocked}>
                          <Unlock size={12} /> Unlocked
                        </span>
                      ) : (
                        <span className={styles.ebookLocked}>
                          <Lock size={12} /> Unlocks 1 hr after class
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
