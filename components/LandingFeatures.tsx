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
      url: "https://store.museinc.com.vn/thue-phong-tap",
    },
    {
      icon: Disc,
      title: t("features.expertInstructors"),
      description: t("features.expertInstructorsDesc"),
      url: "https://store.museinc.com.vn/giang-vien-1",
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
      url: "https://store.museinc.com.vn/thiet-bi",
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
      url: "https://store.museinc.com.vn/lien-he",
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {features.map((feature, index) => {
            const inner = (
              <>
                <div className={styles.iconWrapper}>
                  <feature.icon size={32} />
                </div>
                <h3 className={styles.title}>{feature.title}</h3>
                <p className={styles.description}>{feature.description}</p>
              </>
            );
            return feature.url ? (
              <a
                key={index}
                href={feature.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.card} ${styles.cardLink}`}
              >
                {inner}
              </a>
            ) : (
              <div key={index} className={styles.card}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};