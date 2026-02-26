import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Calendar } from "./Calendar";
import { Checkbox } from "./Checkbox";
import { useUpdateUserProfile, useUserProfile } from "../helpers/useUserProfile";
import { useEnrollCourse } from "../helpers/useEnrollCourse";
import { useCourses } from "../helpers/useCourses";
import { schema as profileSchema } from "../endpoints/user/profile_POST.schema";
import { toast } from "sonner";
import styles from "./RegistrationForm.module.css";

// Extend the schema to handle the UI specific logic if needed, 
// but we should try to stick to the endpoint schema as much as possible.
// The endpoint schema uses strings for dates and enums, we might need to adapt.
// However, the endpoint schema defines dateOfBirth as z.date().nullable().optional() which is good.

const formSchema = profileSchema.extend({
  // We can add UI specific validations here if needed, but the base schema is quite loose
});

type FormValues = z.infer<typeof formSchema>;

export const RegistrationForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCourseId = Number(searchParams.get("courseId"));
  const hasSelectedCourse = Number.isFinite(selectedCourseId) && selectedCourseId > 0;
  const { data: profile, isLoading } = useUserProfile();
  const { data: courses } = useCourses();
  const { mutateAsync: updateProfile, isPending } = useUpdateUserProfile();
  const enrollCourseMutation = useEnrollCourse();

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      fullName: "",
      gender: "",
      address: "",
      phoneNumber: "",
      dateOfBirth: undefined,
      preferredPaymentMethod: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankName: "",
    },
  });

  // Load existing profile data
  useEffect(() => {
    if (profile) {
      form.setValues({
        fullName: profile.fullName || profile.displayName || "",
        gender: profile.gender || "",
        address: profile.address || "",
        phoneNumber: profile.phoneNumber || profile.whatsappNumber || "",
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth) : undefined,
        preferredPaymentMethod: profile.preferredPaymentMethod || "",
        bankAccountName: profile.bankAccountName || "",
        bankAccountNumber: profile.bankAccountNumber || "",
        bankName: profile.bankName || "",
      });
    }
  }, [profile, form.setValues]);

  const onSubmit = async (values: FormValues) => {
    try {
      await updateProfile(values);

      const selectedCourse = hasSelectedCourse
        ? courses?.find((c) => c.id === selectedCourseId)
        : null;

      if (hasSelectedCourse) {
        await enrollCourseMutation.mutateAsync({ courseId: selectedCourseId });
      }

      const notifyResult = await fetch("/_api/registration/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName:
            values.fullName ||
            profile?.fullName ||
            profile?.displayName ||
            "A student",
          gender: values.gender || null,
          address: values.address || null,
          phoneNumber: values.phoneNumber,
          dateOfBirth: values.dateOfBirth
            ? format(values.dateOfBirth, "yyyy-MM-dd")
            : null,
          preferredPaymentMethod: values.preferredPaymentMethod || null,
          bankAccountName: values.bankAccountName || null,
          bankAccountNumber: values.bankAccountNumber || null,
          bankName: values.bankName || null,
          selectedCourseId: hasSelectedCourse ? selectedCourseId : null,
          courseName: hasSelectedCourse
            ? selectedCourse?.name || `Course #${selectedCourseId}`
            : null,
        }),
      });

      if (!notifyResult.ok) {
        let message = "Failed to send registration email";
        try {
          const payload = (await notifyResult.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {}
        throw new Error(message);
      }

      navigate("/dashboard");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to complete registration");
      }
    }
  };

  const paymentMethod = form.values.preferredPaymentMethod;
  const isBankTransfer = paymentMethod === "Bank Transfer";

  if (isLoading) {
    return <div className={styles.loading}>Loading profile data...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thông Tin Cá Nhân (Personal Info)</h3>
          
          <FormItem name="fullName">
            <FormLabel>Họ và Tên (Full Name)</FormLabel>
            <FormControl>
              <Input 
                placeholder="Nguyen Van A" 
                value={form.values.fullName}
                onChange={(e) => form.setValues(prev => ({ ...prev, fullName: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <div className={styles.row}>
            <FormItem name="gender" className={styles.halfWidth}>
              <FormLabel>Giới Tính (Gender)</FormLabel>
              <Select 
                value={form.values.gender || ""} 
                onValueChange={(val) => form.setValues(prev => ({ ...prev, gender: val }))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Male">Nam (Male)</SelectItem>
                  <SelectItem value="Female">Nữ (Female)</SelectItem>
                  <SelectItem value="Other">Khác (Other)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>

            <FormItem name="dateOfBirth" className={styles.halfWidth}>
              <FormLabel>Ngày Sinh (Date of Birth)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={`${styles.dateButton} ${!form.values.dateOfBirth ? styles.mutedText : ""}`}
                    >
                      {form.values.dateOfBirth ? (
                        format(form.values.dateOfBirth, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className={styles.calendarIcon} />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className={styles.calendarPopover} align="start" removeBackgroundAndPadding>
                  <Calendar
                    mode="single"
                    selected={form.values.dateOfBirth || undefined}
                    onSelect={(date) => form.setValues(prev => ({ ...prev, dateOfBirth: date || null }))}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          </div>

          <FormItem name="phoneNumber">
            <FormLabel>Số Điện Thoại (Phone Number)</FormLabel>
            <FormControl>
              <Input 
                placeholder="090 123 4567" 
                value={form.values.phoneNumber}
                onChange={(e) => form.setValues(prev => ({ ...prev, phoneNumber: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="address">
            <FormLabel>Địa Chỉ (Address)</FormLabel>
            <FormControl>
              <Input 
                placeholder="123 Street, District 1, HCMC" 
                value={form.values.address || ""}
                onChange={(e) => form.setValues(prev => ({ ...prev, address: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thanh Toán (Payment)</h3>
          
          <FormItem name="preferredPaymentMethod">
            <FormLabel>Phương Thức Thanh Toán Ưu Tiên (Preferred Payment Method)</FormLabel>
            <div className={styles.radioGroup}>
              {["Cash", "Credit/Debit Card", "Bank Transfer"].map((method) => (
                <div key={method} className={styles.radioItem}>
                  <Checkbox 
                    id={`payment-${method}`}
                    checked={form.values.preferredPaymentMethod === method}
                    onChange={() => form.setValues(prev => ({ ...prev, preferredPaymentMethod: method }))}
                  />
                  <label htmlFor={`payment-${method}`} className={styles.radioLabel}>
                    {method === "Cash" && "Tiền mặt (Cash)"}
                    {method === "Credit/Debit Card" && "Thẻ Tín Dụng/Ghi Nợ (Card)"}
                    {method === "Bank Transfer" && "Chuyển Khoản (Bank Transfer)"}
                  </label>
                </div>
              ))}
            </div>
            <FormMessage />
          </FormItem>

          {isBankTransfer && (
            <div className={styles.bankDetails}>
              <FormItem name="bankName">
                <FormLabel>Tên Ngân Hàng (Bank Name)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Vietcombank, Techcombank..." 
                    value={form.values.bankName || ""}
                    onChange={(e) => form.setValues(prev => ({ ...prev, bankName: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="bankAccountNumber">
                <FormLabel>Số Tài Khoản (Account Number)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="0000 0000 0000" 
                    value={form.values.bankAccountNumber || ""}
                    onChange={(e) => form.setValues(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="bankAccountName">
                <FormLabel>Tên Chủ Tài Khoản (Account Holder Name)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="NGUYEN VAN A" 
                    value={form.values.bankAccountName || ""}
                    onChange={(e) => form.setValues(prev => ({ ...prev, bankAccountName: e.target.value.toUpperCase() }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Button
            type="submit"
            size="lg"
            disabled={isPending || enrollCourseMutation.isPending}
            className={styles.submitButton}
          >
            {isPending || enrollCourseMutation.isPending
              ? "Saving..."
              : "Hoàn Tất Đăng Ký (Complete Registration)"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
