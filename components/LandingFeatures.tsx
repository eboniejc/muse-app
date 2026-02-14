import React from "react";
import { useTranslation } from "react-i18next";
import { Mic2, Disc, BarChart3, Speaker, CreditCard, Phone } from "lucide-react";
import styles from "./LandingFeatures.module.css";

export const LandingFeatures = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: Mic2,
      title: t("features.practiceStudios"),
      description: t("features.practiceStudiosDesc"),
    },
    {
      icon: Disc,
      title: t("features.expertInstructors"),
      description: t("features.expertInstructorsDesc"),
    },
    {
      icon: BarChart3,
      title: t("features.structuredCourses"),
      description: t("features.structuredCoursesDesc"),
    },
    {
      icon: Speaker,
      title: t("features.equipmentRental"),
      description: t("features.equipmentRentalDesc"),
    },
    {
      icon: CreditCard,
      title: t("features.flexiblePayment"),
      description: t("features.flexiblePaymentDesc"),
    },
    {
      icon: Phone,
      title: t("features.support"),
      description: t("features.supportDesc"),
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {features.map((feature, index) => (
            <div key={index} className={styles.card}>
              <div className={styles.iconWrapper}>
                <feature.icon size={32} />
              </div>
              <h3 className={styles.title}>{feature.title}</h3>
              <p className={styles.description}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};