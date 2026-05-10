import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCourses } from "../helpers/useCourses";
import { useUserProfile, useUpdateUserProfile } from "../helpers/useUserProfile";
import { useEnrollCourse } from "../helpers/useEnrollCourse";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Helmet } from "react-helmet";
import { schema as profileSchema } from "../endpoints/user/profile_POST.schema";
import styles from "./courses.$courseId.enroll.module.css";

// We extend the profile schema slightly to include fields we want to show but might not be in the strict POST schema if needed,
// but here we just use the existing profile POST schema for the form.
const formSchema = profileSchema.extend({
  email: z.string().email().optional(), // Read-only
});

type FormValues = z.infer<typeof formSchema>;

export default function CourseEnrollPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const courseIdNumber = Number(courseId);
  
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  
  const updateProfileMutation = useUpdateUserProfile();
  const enrollCourseMutation = useEnrollCourse();

  const course = courses?.find((c) => c.id === courseIdNumber);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      address: "",
      gender: "_empty",
      dateOfBirth: undefined,
    },
  });

  // Prefill form when data is loaded
  useEffect(() => {
    if (userProfile) {
      form.reset({
        fullName: userProfile.fullName || userProfile.displayName || "",
        email: userProfile.email || "",
        phoneNumber: userProfile.phoneNumber || "",
        address: userProfile.address || "",
        gender: userProfile.gender || "_empty",
        dateOfBirth: userProfile.dateOfBirth ? new Date(userProfile.dateOfBirth) : undefined,
        // Add other fields if needed for the schema, passing undefined/null as appropriate
        preferredPaymentMethod: userProfile.preferredPaymentMethod,
        bankAccountName: userProfile.bankAccountName,
        bankAccountNumber: userProfile.bankAccountNumber,
        bankName: userProfile.bankName,
      });
    }
  }, [userProfile, form]);

  const onSubmit = async (data: FormValues) => {
    if (!course) return;

    try {
      // 1. Update Profile
      // We clean up the data before sending: 
      // - remove email (not updatable via this endpoint usually, or just ignored)
      // - handle gender _empty
      const profileData = {
        ...data,
        gender: data.gender === "_empty" ? null : data.gender,
        // Ensure we send all required fields for the update profile endpoint
      };

            
      await updateProfileMutation.mutateAsync(profileData);

      // 2. Enroll
      await enrollCourseMutation.mutateAsync({
        courseId: course.id,
      });

      toast.success(t("enrollment.successMessage"));
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      // Errors handled by mutations mostly, but good to catch generic ones
    }
  };

  // DOB split-select state
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");

  // Sync split selects → form value (noon Vietnam time = UTC+7, stored as 05:00 UTC)
  useEffect(() => {
    if (dobMonth && dobDay && dobYear) {
      const isoString = `${dobYear}-${String(dobMonth).padStart(2, "0")}-${String(dobDay).padStart(2, "0")}T05:00:00.000Z`;
      const d = new Date(isoString);
      if (!isNaN(d.getTime())) {
        form.setValue("dateOfBirth", d, { shouldValidate: true });
      }
    } else {
      form.setValue("dateOfBirth", undefined, { shouldValidate: false });
    }
  }, [dobMonth, dobDay, dobYear]);

  // Sync form value → split selects when profile loads
  useEffect(() => {
    const dob = form.getValues("dateOfBirth");
    if (dob) {
      const d = new Date(dob);
      setDobMonth(String(d.getMonth() + 1));
      setDobDay(String(d.getDate()));
      setDobYear(String(d.getFullYear()));
    }
  }, [userProfile]);

  const currentYear = new Date().getFullYear();
  const dobYears = Array.from({ length: 101 }, (_, i) => currentYear - i);
  const dobMonths = [
    { value: "1", label: "January" }, { value: "2", label: "February" },
    { value: "3", label: "March" }, { value: "4", label: "April" },
    { value: "5", label: "May" }, { value: "6", label: "June" },
    { value: "7", label: "July" }, { value: "8", label: "August" },
    { value: "9", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];
  const daysInMonth = dobMonth && dobYear
    ? new Date(Number(dobYear), Number(dobMonth), 0).getDate()
    : 31;
  const dobDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isLoading = coursesLoading || profileLoading;
  const isSubmitting = updateProfileMutation.isPending || enrollCourseMutation.isPending;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Skeleton className="h-10 w-48 mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h2>Course not found</h2>
          <Button asChild variant="outline">
            <Link to="/courses">Back to Courses</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Helmet>
        <title>{t("enrollment.title")} - {course.name}</title>
      </Helmet>

      <div className={styles.header}>
        <Button variant="ghost" asChild className={styles.backButton}>
          <Link to={`/courses`}>
            <ArrowLeft size={16} /> {t("common.cancel")}
          </Link>
        </Button>
        <h1 className={styles.title}>{t("enrollment.confirmEnroll")}</h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t("enrollment.courseInfo")}</h2>
            <div className={styles.courseCard}>
              <div className={styles.courseHeader}>
                <h3 className={styles.courseName}>{course.name}</h3>
                <span className={styles.badge}>{course.skillLevel}</span>
              </div>
              <p className={styles.description}>{course.description}</p>
              
              <div className={styles.detailRow}>
                <span className={styles.label}>{t("courses.instructor")}</span>
                <span className={styles.value}>{course.instructorName || t("common.tba")}</span>
              </div>
              
              <div className={styles.detailRow}>
                <span className={styles.label}>{t("courses.duration")}</span>
                <span className={styles.value}>{course.totalLessons} {t("courses.weeks")}</span>
              </div>

              <div className={styles.priceRow}>
                <span className={styles.priceLabel}>{t("courses.price")}</span>
                <span className={styles.priceValue}>
                  {course.price ? `${Number(course.price).toLocaleString("en-US")}₫` : "Free"}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t("enrollment.personalInfo")}</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>{t("registration.fullName")}</label>
                <Input {...form.register("fullName")} disabled={isSubmitting} />
                {form.formState.errors.fullName && (
                  <span className={styles.error}>{form.formState.errors.fullName.message}</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t("auth.emailLabel")}</label>
                <Input {...form.register("email")} disabled={true} className={styles.readOnly} />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t("registration.phoneNumber")}</label>
                  <Input {...form.register("phoneNumber")} disabled={isSubmitting} />
                  {form.formState.errors.phoneNumber && (
                    <span className={styles.error}>{form.formState.errors.phoneNumber.message}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>{t("registration.dob")}</label>
                  <div className={styles.dobRow}>
                    <select
                      className={styles.dobSelect}
                      value={dobMonth}
                      onChange={(e) => setDobMonth(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="">Month</option>
                      {dobMonths.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      className={styles.dobSelect}
                      value={dobDay}
                      onChange={(e) => setDobDay(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="">Day</option>
                      {dobDays.map((d) => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <select
                      className={styles.dobSelect}
                      value={dobYear}
                      onChange={(e) => setDobYear(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="">Year</option>
                      {dobYears.map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {form.formState.errors.dateOfBirth && (
                    <span className={styles.error}>{form.formState.errors.dateOfBirth.message}</span>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t("registration.gender")}</label>
                <Select 
                  value={form.watch("gender") || "_empty"} 
                  onValueChange={(val) => form.setValue("gender", val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_empty" disabled>Select Gender</SelectItem>
                    <SelectItem value="male">{t("enrollment.gender.male")}</SelectItem>
                    <SelectItem value="female">{t("enrollment.gender.female")}</SelectItem>
                    <SelectItem value="other">{t("enrollment.gender.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{t("registration.address")}</label>
                <Input {...form.register("address")} disabled={isSubmitting} />
              </div>

              <div className={styles.actions}>
                <Button 
                  type="submit" 
                  size="lg" 
                  className={styles.submitButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    t("enrollment.enrolling")
                  ) : (
                    <>
                      {t("enrollment.confirmEnroll")} <CheckCircle2 size={18} />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}