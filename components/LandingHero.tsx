import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { useAuth } from "../helpers/useAuth";
import styles from "./LandingHero.module.css";

export const LandingHero = () => {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const isAuthenticated = authState.type === "authenticated";

  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <h1 className={styles.headline}>
          MUSE <span className={styles.highlight}>INC</span>
        </h1>
        <p className={styles.tagline}>{t("landing.heroTitle")}</p>
        <p className={styles.subheadline}>{t("landing.heroSubtitle")}</p>
        <div className={styles.ctaGroup}>
          {isAuthenticated ? (
            <Button size="lg" asChild>
              <Link to="/dashboard">{t("nav.dashboard")}</Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild>
                <Link to="/login">{t("landing.ctaStart")}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/courses">{t("landing.ctaExplore")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className={styles.visual}>
        <div className={styles.glow} />
        <div className={styles.grid} />
      </div>
    </section>
  );
};