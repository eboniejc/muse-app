import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCourses } from "../helpers/useCourses";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import styles from "./LandingCourses.module.css";

export const LandingCourses = () => {
  const { t } = useTranslation();
  const { data: courses, isLoading } = useCourses();

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.heading}>{t("courses.djCourses")}</h2>
          <Button variant="outline" asChild>
            <Link to="/courses">{t("courses.viewAll")}</Link>
          </Button>
        </div>

        <div className={styles.grid}>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.card}>
                <Skeleton className="h-48 w-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          ) : (
            courses?.map((course) => (
              <div key={course.id} className={styles.card}>
                <div className={styles.cardContent}>
                  <div className={styles.badges}>
                    <Badge variant="secondary">{course.skillLevel}</Badge>
                    <Badge variant="outline">
                      {course.durationWeeks} {t("courses.weeks")}
                    </Badge>
                  </div>
                  <h3 className={styles.courseTitle}>{course.name}</h3>
                  {course.price && (
                    <div className={styles.price}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(course.price))}
                    </div>
                  )}
                  <p className={styles.courseDesc}>{course.description}</p>
                  <div className={styles.instructor}>
                    <span className={styles.instructorLabel}>
                      {t("courses.instructor")}
                    </span>
                    <span className={styles.instructorName}>
                      {course.instructorName || t("common.tba")}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};