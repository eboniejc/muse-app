import React from "react";
import { Lock, Unlock, BookOpen, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { EbookWithStatus } from "../endpoints/ebooks/list_GET.schema";
import styles from "./EbookCard.module.css";

interface EbookCardProps {
  ebook: EbookWithStatus;
}

export const EbookCard: React.FC<EbookCardProps> = ({ ebook }) => {
  const { t, i18n } = useTranslation();
  const isUnlocked = ebook.isUnlocked;

  const currentLang = i18n.language;
  const displayTitle =
    currentLang === "vi"
      ? ebook.titleVi || ebook.title
      : ebook.title || ebook.titleVi;
  const displaySubtitle =
    currentLang === "vi"
      ? ebook.titleVi ? ebook.title : null // If showing Vi title, subtitle is En title if it exists (but usually we just swap)
      : ebook.titleVi; // If showing En title, subtitle is Vi title

  // Simplified logic for subtitle based on original code which showed titleVi as subtitle always
  // Original: <h3 className={styles.title}>{ebook.title}</h3>
  //           {ebook.titleVi && <h4 className={styles.subtitle}>{ebook.titleVi}</h4>}
  
  // New logic requested:
  // "For the title, show ebook.titleVi when language is 'vi' and ebook.title when 'en' (or fall back...)"
  // The original code displayed BOTH. The request implies replacing the main title. 
  // However, often dual language cards show Primary(Current Lang) and Secondary(Other Lang).
  // Let's stick strictly to the requirement: "show ebook.titleVi when language is 'vi'..."
  
  const title = currentLang === 'vi' ? (ebook.titleVi || ebook.title) : (ebook.title || ebook.titleVi);
  // For the "subtitle", the request didn't explicitly say to remove it or change it, 
  // but usually if we switch the main title, we might want to show the OTHER title as subtitle or just hide it.
  // The prompt says: "For the title, show ebook.titleVi when language is 'vi' and ebook.title when 'en'"
  // It didn't say "only show one title". 
  // But let's look at the description requirement: "show ebook.descriptionVi when language is 'vi'..."
  
  const description = currentLang === 'vi' ? (ebook.descriptionVi || ebook.description) : (ebook.description || ebook.descriptionVi);

  return (
    <div className={`${styles.card} ${!isUnlocked ? styles.locked : ""}`}>
      <div className={styles.coverContainer}>
        {ebook.coverImageUrl ? (
          <img 
            src={ebook.coverImageUrl} 
            alt={ebook.title} 
            className={styles.coverImage} 
          />
        ) : (
          <div className={styles.placeholderCover}>
            <BookOpen size={48} className={styles.placeholderIcon} />
          </div>
        )}
        <div className={styles.statusBadge}>
          {isUnlocked ? (
            <Badge variant="success" className={styles.unlockedBadge}>
              <Unlock size={12} style={{ marginRight: 4 }} />{" "}
              {t("ebooks.unlocked")}
            </Badge>
          ) : (
            <Badge variant="secondary" className={styles.lockedBadge}>
              <Lock size={12} style={{ marginRight: 4 }} /> {t("ebooks.locked")}
            </Badge>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.meta}>
          {ebook.courseName && (
            <span className={styles.courseName}>{ebook.courseName}</span>
          )}
          <h3 className={styles.title}>{title}</h3>
          {/* We keep the subtitle as the 'other' language if available, or hide it if it duplicates */}
          {currentLang === "vi" && ebook.title && ebook.title !== title && (
            <h4 className={styles.subtitle}>{ebook.title}</h4>
          )}
          {currentLang === "en" && ebook.titleVi && ebook.titleVi !== title && (
            <h4 className={styles.subtitle}>{ebook.titleVi}</h4>
          )}
        </div>

        <p className={styles.description}>
          {description || "No description available."}
        </p>

        <div className={styles.actions}>
          {isUnlocked ? (
            <Button asChild className={styles.actionButton} variant="primary">
              <a
                href={ebook.fileUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download size={16} />
                {t("ebooks.downloadView")}
              </a>
            </Button>
          ) : (
            <div className={styles.lockMessage}>
              <Lock size={14} />
              <span>
                {t("ebooks.completeCourseToUnlock", {
                  course: ebook.courseName || "course",
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};