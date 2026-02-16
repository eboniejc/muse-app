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

  const orderedEbookLinks = [
    "https://drive.google.com/file/d/161qr5Le9QUn_TaB3RGWeWEGLOhBM-u_r/view?usp=drive_link",
    "https://drive.google.com/file/d/1UWl48BPet3P6GdN9MyxBMHfr9yCDN8K5/view?usp=drive_link",
    "https://drive.google.com/file/d/1HbHh39duXPRaHdg0DcmEcCPvMHDNaHcL/view?usp=drive_link",
    "https://drive.google.com/file/d/1q8z50bCissHMCegmVg-QXnrLCFjCZs53/view?usp=drive_link",
    "https://drive.google.com/file/d/1IirRh5Rs8SlOO4NIB0yi02gv3M09BZaD/view?usp=drive_link",
    "https://drive.google.com/file/d/1iWQPll_P1VT3Rtos-MTkwcPP1GHBKaMG/view?usp=drive_link",
    "https://drive.google.com/file/d/1hxHELh9eBGgFVC_Ksyx2sHKmP78__vWF/view?usp=drive_link",
    "https://drive.google.com/file/d/1FfYtCPA5sX25fp51c-M5zswXmtdRTzvJ/view?usp=drive_link",
    "https://drive.google.com/file/d/1LTX6jfHmX6lnO6LTps6ocAAd2f8IiKyz/view?usp=drive_link",
    "https://drive.google.com/file/d/1VMlIhFOJ2MK7Pt6esdEJpvf22fWuMMma/view?usp=drive_link",
    "https://drive.google.com/file/d/1AyINHC7I3aqR8o2NooIaEuUfXTdSfi2c/view?usp=drive_link",
    "https://drive.google.com/file/d/1szF0laTSgjENv1WGXRQw6bC2W_UoUSfi/view?usp=drive_link",
    "https://drive.google.com/file/d/1gkdCxt6O9EDNrsbrjm_GY5xczm5cIsYQ/view?usp=drive_link",
    "https://drive.google.com/file/d/15VyzWtEOALjx5mfu-Yv50so6g6Z8fUN7/view?usp=drive_link",
    "https://drive.google.com/file/d/1339VfTCqY62bRuOZMqQ9PwZJOtk20FBR/view?usp=drive_link",
    "https://drive.google.com/file/d/1tJHhA3fJSnNkxEX24yAgcwDMMowAD1XN/view?usp=drive_link",
    "https://docs.google.com/document/d/1O-Iu4z3rvc94w5F6fkDwERw6Z79G5V9d/edit?usp=drive_link&ouid=109745014509333769352&rtpof=true&sd=true",
  ];

  const presetEbooks: EbookWithStatus[] = orderedEbookLinks.map(
    (fileUrl, index) => ({
      id: -(index + 1),
      title: `E-book ${index + 1}`,
      titleVi: `E-book ${index + 1}`,
      description: `DJ learning material #${index + 1}`,
      descriptionVi: `Tài liệu học DJ #${index + 1}`,
      coverImageUrl: null,
      fileUrl,
      courseId: null,
      sortOrder: index,
      courseName: null,
      isUnlocked: true,
    })
  );

  const mergedEbooks = React.useMemo(() => {
    const deduped = new Map<string, EbookWithStatus>();
    [...presetEbooks, ...(ebooks ?? [])].forEach((ebook) => {
      const key = ebook.title.toLowerCase().trim();
      deduped.set(key, ebook);
    });
    return Array.from(deduped.values());
  }, [ebooks]);

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
