import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, User, BookOpen, Clock, AlertCircle } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Progress } from "./Progress";
import { AdminEnrollment } from "../endpoints/admin/enrollments/list_GET.schema";
import { useMarkLessonComplete, useMarkLessonUncomplete } from "../helpers/useAdminEnrollments";
import styles from "./AdminEnrollmentCard.module.css";

interface Props {
  enrollment: AdminEnrollment;
}

export const AdminEnrollmentCard: React.FC<Props> = ({ enrollment }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const markComplete = useMarkLessonComplete();
  const markUncomplete = useMarkLessonUncomplete();

  const isUpdating = markComplete.isPending || markUncomplete.isPending;

  const toggleLesson = (lessonNumber: number, isCompleted: boolean) => {
    if (isUpdating) return;
    
    if (isCompleted) {
      markUncomplete.mutate({
        enrollmentId: enrollment.id,
        lessonNumber,
      });
    } else {
      markComplete.mutate({
        enrollmentId: enrollment.id,
        lessonNumber,
      });
    }
  };

  // Helper to determine badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "completed": return "success";
      case "cancelled": return "destructive";
      case "paused": return "warning";
      default: return "secondary";
    }
  };

  // Generate lesson list
  const lessons = Array.from({ length: enrollment.totalLessons }, (_, i) => i + 1);
  const completedLessonNumbers = new Set(
    enrollment.lessonCompletions.map(l => l.lessonNumber)
  );

  return (
    <div className={`${styles.card} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.mainRow} onClick={() => setExpanded(!expanded)}>
        <div className={styles.infoCol}>
          <div className={styles.studentInfo}>
            <div className={styles.avatarPlaceholder}>
              <User size={16} />
            </div>
            <div>
              <div className={styles.studentName}>{enrollment.studentName}</div>
              <div className={styles.studentEmail}>{enrollment.studentEmail}</div>
            </div>
          </div>
        </div>

        <div className={styles.courseCol}>
          <div className={styles.courseName}>{enrollment.courseName}</div>
          <div className={styles.metaRow}>
            {enrollment.skillLevel && <Badge variant="outline" className={styles.tinyBadge}>{enrollment.skillLevel}</Badge>}
            <span className={styles.date}>{format(new Date(enrollment.enrolledAt), 'MMM d, yyyy')}</span>
          </div>
        </div>

        <div className={styles.statusCol}>
          <Badge variant={getStatusVariant(enrollment.status)}>
            {t(`admin.${enrollment.status}`)}
          </Badge>
        </div>

        <div className={styles.progressCol}>
          <div className={styles.progressText}>
            <span>{enrollment.completedLessons} / {enrollment.totalLessons}</span>
            <span>{enrollment.progressPercentage}%</span>
          </div>
          <Progress value={enrollment.progressPercentage} />
        </div>

        <div className={styles.expandCol}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {expanded && (
        <div className={styles.detailsPanel}>
          <h4 className={styles.lessonsTitle}>
            <BookOpen size={16} />
            {t('admin.lessonProgress')}
          </h4>
          
          <div className={styles.lessonsGrid}>
            {lessons.map((lessonNum) => {
              const isCompleted = completedLessonNumbers.has(lessonNum);
              return (
                <div 
                  key={lessonNum} 
                  className={`${styles.lessonItem} ${isCompleted ? styles.completed : ''} ${isUpdating ? styles.disabled : ''}`}
                  onClick={() => toggleLesson(lessonNum, isCompleted)}
                >
                  <div className={styles.checkbox}>
                    {isCompleted && <div className={styles.checkmark} />}
                  </div>
                  <span className={styles.lessonLabel}>{t('admin.lesson')} {lessonNum}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.detailsFooter}>
             <div className={styles.footerInfo}>
                <Clock size={14} />
                <span>Enrolled: {format(new Date(enrollment.enrolledAt), 'PPP')}</span>
             </div>
             {enrollment.completedAt && (
               <div className={styles.footerInfo}>
                 <AlertCircle size={14} />
                 <span>Completed: {format(new Date(enrollment.completedAt), 'PPP')}</span>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};