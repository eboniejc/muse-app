import React from "react";
import { useTranslation } from "react-i18next";
import { Music2, Facebook, Youtube, Instagram, MessageCircle } from "lucide-react";
import { LanguageToggle } from "./LanguageToggle";
import styles from "./LandingFooter.module.css";

export const LandingFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.column}>
          <div className={styles.brand}>
            <Music2 className={styles.icon} />
            <span className={styles.name}>MUSE INC</span>
          </div>
          <p className={styles.description}>
            The premier DJ school and professional audio equipment supplier in Vietnam.
          </p>
          <div className={styles.socials}>
            <a href="#" className={styles.socialLink} aria-label="Facebook"><Facebook size={20} /></a>
            <a href="#" className={styles.socialLink} aria-label="Youtube"><Youtube size={20} /></a>
            <a href="#" className={styles.socialLink} aria-label="Instagram"><Instagram size={20} /></a>
            <a href="#" className={styles.socialLink} aria-label="TikTok"><MessageCircle size={20} /></a>
          </div>
        </div>

        <div className={styles.column}>
          <h4 className={styles.heading}>{t("landing.footerContact")}</h4>
          <address className={styles.contactInfo}>
            <p>(Rear Entrance) 409 Hai Ba Trung St.</p>
            <p>Xuan Hoa Ward, HCMC, Vietnam</p>
            <p>Hotline: <a href="tel:0902957911">090 295 79 11</a></p>
            <p>Email: <a href="mailto:info@museinc.com.vn">info@museinc.com.vn</a></p>
          </address>
        </div>
      </div>
      
      <div className={styles.bottomBar}>
        <span className={styles.copyright}>© 2025 MUSE INC. All rights reserved.</span>
        <div className={styles.languageToggle}>
          <LanguageToggle />
        </div>
      </div>
    </footer>
  );
};