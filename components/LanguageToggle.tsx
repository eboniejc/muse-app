import React from "react";
import { useLanguage } from "../helpers/i18n";
import { Button } from "./Button";
import styles from "./LanguageToggle.module.css";

interface LanguageToggleProps {
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  className,
}) => {
  const { language, toggleLanguage } = useLanguage();

  const isVietnamese = language === "vi";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className={`${styles.toggle} ${className || ""}`}
      title={isVietnamese ? "Switch to English" : "Chuyển sang Tiếng Việt"}
      aria-label={
        isVietnamese ? "Switch language to English" : "Chuyển ngôn ngữ sang Tiếng Việt"
      }
    >
      <span className={styles.flag}>{isVietnamese ? "🇻🇳" : "🇬🇧"}</span>
      <span className={styles.code}>{isVietnamese ? "VN" : "EN"}</span>
    </Button>
  );
};