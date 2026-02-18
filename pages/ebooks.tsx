import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useEbooks } from "../helpers/useEbooks";
import { EbookCard } from "../components/EbookCard";
import { EbookWithStatus } from "../endpoints/ebooks/list_GET.schema";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import styles from "./ebooks.module.css";

type FilterType = "all" | "unlocked" | "locked";

export default function EbooksPage() {
  const { t } = useTranslation();
  const { data: ebooks, isLoading } = useEbooks();
  const [filter, setFilter] = useState<FilterType>("all");
  const mergedEbooks = ebooks ?? [];

  const filteredEbooks = mergedEbooks.filter((ebook) => {
    if (filter === "all") return true;
    if (filter === "unlocked") return ebook.isUnlocked;
    if (filter === "locked") return !ebook.isUnlocked;
    return true;
  });

  return (
    <div className={styles.container}>
      <Helmet>
        <title>{t("ebooks.title")} - MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>{t("ebooks.title")}</h1>
        <p className={styles.description}>
          Complete courses to unlock exclusive learning materials and guides.
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.tabs}>
          <Button
            variant={filter === "all" ? "primary" : "ghost"}
            onClick={() => setFilter("all")}
            size="sm"
          >
            {t("ebooks.filterAll")}
          </Button>
          <Button
            variant={filter === "unlocked" ? "primary" : "ghost"}
            onClick={() => setFilter("unlocked")}
            size="sm"
          >
            {t("ebooks.filterUnlocked")}
          </Button>
          <Button
            variant={filter === "locked" ? "primary" : "ghost"}
            onClick={() => setFilter("locked")}
            size="sm"
          >
            {t("ebooks.filterLocked")}
          </Button>
        </div>
      </div>

      <div className={styles.grid}>
        {isLoading && mergedEbooks.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton className={styles.skeletonCover} />
              <div className={styles.skeletonContent}>
                <Skeleton className={styles.skeletonTitle} />
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonText} />
                <Skeleton className={styles.skeletonButton} />
              </div>
            </div>
          ))
        ) : filteredEbooks.length > 0 ? (
          filteredEbooks.map((ebook) => (
            <EbookCard key={ebook.id} ebook={ebook} />
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>No ebooks found matching your filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
