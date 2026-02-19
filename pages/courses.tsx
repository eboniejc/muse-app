import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useCourses } from "../helpers/useCourses";
import { CourseCard } from "../components/CourseCard";
import { CourseWithDetails } from "../endpoints/courses/list_GET.schema";
import { Input } from "../components/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { Search } from "lucide-react";
import styles from "./courses.module.css";

export default function CoursesPage() {
  const { t } = useTranslation();
  const { data: courses, isLoading } = useCourses();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const mergedCourses = courses ?? [];

  const filteredCourses = mergedCourses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(search.toLowerCase()) || 
                          course.description?.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === "all" || course.skillLevel?.toLowerCase() === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Courses - MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('courses.title')}</h1>
          <p className={styles.subtitle}>{t('courses.subtitle')}</p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={18} />
          <Input 
            placeholder={t('courses.searchPlaceholder')}
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterWrapper}>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className={styles.selectTrigger}>
              <SelectValue placeholder="Skill Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('courses.allLevels')}</SelectItem>
              <SelectItem value="beginner">{t('courses.beginner')}</SelectItem>
              <SelectItem value="intermediate">{t('courses.intermediate')}</SelectItem>
              <SelectItem value="advanced">{t('courses.advanced')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={styles.grid}>
        {isLoading && mergedCourses.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton className="h-8 w-3/4 mb-4" />
              <Skeleton className="h-24 w-full mb-4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))
        ) : filteredCourses.length > 0 ? (
          filteredCourses.map(course => (
            <CourseCard key={course.id} course={course} />
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>{t('courses.noCourses')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
