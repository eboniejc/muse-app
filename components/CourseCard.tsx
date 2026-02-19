import React from "react";
import { CourseWithDetails } from "../endpoints/courses/list_GET.schema";
import { useCourseEnrollments } from "../helpers/useCourseEnrollments";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Clock, Users, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./CourseCard.module.css";

interface CourseCardProps {
  course: CourseWithDetails;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: enrollments } = useCourseEnrollments();

  const enrollment = enrollments?.find(
    (e) => String(e.courseId) === String(course.id)
  );
  const isEnrolled = !!enrollment;

  const handleEnrollClick = () => {
    navigate(`/complete-registration?courseId=${course.id}`);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.badges}>
          <Badge variant="secondary">{course.skillLevel}</Badge>
          {isEnrolled && <Badge variant="success">Enrolled</Badge>}
        </div>
        <h3 className={styles.title}>{course.name}</h3>
      </div>

      <p className={styles.description}>{course.description}</p>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <BookOpen size={16} />
                    <span>
            {course.totalLessons} {t("courses.weeks")}
          </span>
        </div>
        <div className={styles.metaItem}>
          <Users size={16} />
                    <span>
            {course.enrolledCount} Students
          </span>
        </div>
      </div>

      {isEnrolled && enrollment ? (
        <div className={styles.footer}>
          <div className={styles.price}>Enrolled</div>
          <Button onClick={() => navigate("/dashboard")} className={styles.enrollBtn} variant="secondary">
            View Dashboard
          </Button>
        </div>
      ) : (
        <div className={styles.footer}>
          <div className={styles.price}>
            {course.price ? `$${course.price}` : "Free"}
          </div>
          <Button onClick={handleEnrollClick} className={styles.enrollBtn}>
            {t("courses.enroll")}
          </Button>
        </div>
      )}
    </div>
  );
};
