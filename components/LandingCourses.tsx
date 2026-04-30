import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCourses } from "../helpers/useCourses";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { CourseCard } from "./CourseCard";
import { MembershipPassCard } from "./MembershipPassCard";
import { MEMBERSHIP_PASSES } from "../helpers/membershipPasses";
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
              <div key={i} className={styles.skeletonCard}>
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-24 w-full mb-4" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))
          ) : (
            <>
              {courses?.map((course) => (
                <CourseCard key={course.id} course={course} showEnrollment={false} />
              ))}
              {MEMBERSHIP_PASSES.map((pass) => (
                <MembershipPassCard key={pass.id} name={pass.name} price={pass.price} imageUrl={pass.imageUrl} />
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
};