import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Search, SlidersHorizontal } from "lucide-react";
import { useAdminEnrollments } from "../helpers/useAdminEnrollments";
import { useCourses } from "../helpers/useCourses";
import { Input } from "../components/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { AdminEnrollmentCard } from "../components/AdminEnrollmentCard";
import styles from "./admin.module.css";

export default function AdminPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: courses } = useCourses();
  
  // Pass filters to the hook if needed for server-side filtering, 
  // but for search we'll likely do client-side if the dataset is small enough or the hook supports it.
  // The hook supports courseId and status.
  const { data: enrollments, isLoading } = useAdminEnrollments({
    status: statusFilter !== "all" ? statusFilter : undefined,
    courseId: courseFilter !== "all" ? Number(courseFilter) : undefined,
  });

  const filteredEnrollments = enrollments?.filter((enrollment) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      enrollment.studentName.toLowerCase().includes(term) ||
      enrollment.studentEmail.toLowerCase().includes(term) ||
      enrollment.courseName.toLowerCase().includes(term)
    );
  });

  return (
    <div className={styles.container}>
      <Helmet>
        <title>{t("admin.title")} - MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("admin.title")}</h1>
          <p className={styles.subtitle}>{t("admin.enrollments")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={18} />
          <Input 
            placeholder="Search students or courses..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={styles.selectTrigger}>
                <div className={styles.selectLabel}>
                  <SlidersHorizontal size={14} />
                  <span>{t("admin.status")}</span>
                </div>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.allStatuses")}</SelectItem>
                <SelectItem value="active">{t("admin.active")}</SelectItem>
                <SelectItem value="completed">{t("admin.completed")}</SelectItem>
                <SelectItem value="cancelled">{t("admin.cancelled")}</SelectItem>
                <SelectItem value="paused">{t("admin.paused")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={styles.filterItem}>
             <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className={styles.selectTrigger}>
                <div className={styles.selectLabel}>
                  <span>{t("admin.course")}</span>
                </div>
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map(course => (
                  <SelectItem key={course.id} value={String(course.id)}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.skeletonList}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredEnrollments && filteredEnrollments.length > 0 ? (
          <div className={styles.list}>
            {filteredEnrollments.map((enrollment) => (
              <AdminEnrollmentCard key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>{t("admin.noEnrollments")}</p>
          </div>
        )}
      </div>
    </div>
  );
}