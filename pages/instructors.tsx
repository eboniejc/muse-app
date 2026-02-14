import React from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { MapPin, Phone, Mail } from "lucide-react";
import { useInstructors } from "../helpers/useInstructors";
import { InstructorCard } from "../components/InstructorCard";
import { Skeleton } from "../components/Skeleton";
import styles from "./instructors.module.css";

export default function InstructorsPage() {
  const { t } = useTranslation();
  const { data: instructors, isLoading } = useInstructors();

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Instructors - DJ School</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>{t('instructors.title')}</h1>
        <p className={styles.description}>
          {t('instructors.subtitle')}
        </p>
      </div>

      <div className={styles.grid}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonHeader}>
                <Skeleton className={styles.skeletonAvatar} />
                <div className={styles.skeletonInfo}>
                  <Skeleton className={styles.skeletonName} />
                  <Skeleton className={styles.skeletonBadge} />
                </div>
              </div>
              <Skeleton className={styles.skeletonButton} />
            </div>
          ))
        ) : instructors && instructors.length > 0 ? (
          instructors.map((instructor) => (
            <InstructorCard key={instructor.id} instructor={instructor} />
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>{t('instructors.noInstructors')}</p>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <div className={styles.contactInfo}>
          <h3 className={styles.contactTitle}>MUSE Inc.</h3>
          <div className={styles.contactItem}>
            <MapPin size={18} className={styles.icon} />
            <span>409 Hai Bà Trưng, Phường Xuân Hoà, TP Ho Chi Minh City, Vietnam</span>
          </div>
          <div className={styles.contactItem}>
            <Phone size={18} className={styles.icon} />
            <span>090 295 79 11 / 089.8546.945</span>
          </div>
          <div className={styles.contactItem}>
            <Mail size={18} className={styles.icon} />
            <span>info@museinc.com.vn</span>
          </div>
        </div>
      </footer>
    </div>
  );
}