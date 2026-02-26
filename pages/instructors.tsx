import React from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { MapPin, Phone, Mail } from "lucide-react";
import { useInstructors } from "../helpers/useInstructors";
import { InstructorCard } from "../components/InstructorCard";
import { Skeleton } from "../components/Skeleton";
import { BrandMark } from "../components/BrandMark";
import { Instructor } from "../endpoints/instructors/list_GET.schema";
import styles from "./instructors.module.css";

export default function InstructorsPage() {
  const { t } = useTranslation();
  const { data: instructors, isLoading } = useInstructors();
  const presetInstructors: Instructor[] = [
    {
      id: -1,
      displayName: "DJ Phatbeatz",
      email: "",
      avatarUrl: null,
      whatsappNumber: "+84902957911",
      whatsappLink: "https://wa.me/84902957911",
    },
    {
      id: -2,
      displayName: "DJ Napple",
      email: "",
      avatarUrl: null,
      whatsappNumber: "+84932484884",
      whatsappLink: "https://wa.me/84932484884",
    },
    {
      id: -3,
      displayName: "DJ Zackie",
      email: "",
      avatarUrl: null,
      whatsappNumber: "+84909515597",
      whatsappLink: "https://wa.me/84909515597",
    },
    {
      id: -4,
      displayName: "DJ Zbuzh",
      email: "",
      avatarUrl: null,
      whatsappNumber: "+84932222292",
      whatsappLink: "https://wa.me/84932222292",
    },
    {
      id: -5,
      displayName: "DJ ChieChan",
      email: "",
      avatarUrl: null,
      whatsappNumber: "+84901931801",
      whatsappLink: "https://wa.me/84901931801",
    },
  ];

  const mergedInstructors = React.useMemo(() => {
    const deduped = new Map<string, Instructor>();

    [...presetInstructors, ...(instructors ?? [])].forEach((inst) => {
      const phoneKey = (inst.whatsappNumber || "").replace(/\D/g, "");
      const nameKey = inst.displayName.toLowerCase().trim();
      const key = phoneKey || nameKey;
      deduped.set(key, inst);
    });

    return Array.from(deduped.values());
  }, [instructors]);

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Instructors - MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>{t('instructors.title')}</h1>
        <p className={styles.description}>
          {t('instructors.subtitle')}
        </p>
      </div>

      <div className={styles.grid}>
        {isLoading && mergedInstructors.length === 0 ? (
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
        ) : mergedInstructors.length > 0 ? (
          mergedInstructors.map((instructor) => (
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
          <div className={styles.contactTitle}>
            <BrandMark size="md" />
          </div>
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
