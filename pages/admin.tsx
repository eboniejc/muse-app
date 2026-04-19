import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Bell, PartyPopper, KeyRound, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { useScheduleEventNotifications } from "../helpers/useAdminEnrollments";
import { useUpcomingEvents } from "../helpers/useUpcomingEvents";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import styles from "./admin.module.css";

export default function AdminPage() {
  const [notifiedEventIds, setNotifiedEventIds] = useState<Set<number>>(new Set());

  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    setResetLoading(true);
    try {
      const res = await fetch("/_api/admin/users/reset_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim(), newPassword: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetStatus({ type: "success", message: "Password updated successfully." });
        setResetEmail("");
        setResetPassword("");
      } else {
        setResetStatus({ type: "error", message: data.message ?? "Something went wrong." });
      }
    } catch {
      setResetStatus({ type: "error", message: "Something went wrong." });
    } finally {
      setResetLoading(false);
    }
  };

  const { data: upcomingEvents } = useUpcomingEvents();
  const scheduleEventMutation = useScheduleEventNotifications();

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Admin - MUSE INC</title>
      </Helmet>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin</h1>
        </div>
      </div>

      <div className={styles.resetSection}>
        <h2 className={styles.resetSectionTitle}>
          <KeyRound size={18} />
          Reset Student Password
        </h2>
        <form onSubmit={handleResetPassword} className={styles.resetForm}>
          <div className={styles.resetField}>
            <label className={styles.resetLabel}>Student Email</label>
            <Input
              type="email"
              placeholder="student@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={resetLoading}
              required
            />
          </div>
          <div className={styles.resetField}>
            <label className={styles.resetLabel}>New Password</label>
            <div className={styles.passwordWrapper}>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Min 6 characters"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                disabled={resetLoading}
                required
                minLength={6}
                className={styles.passwordInput}
              />
              <button
                type="button"
                className={styles.showPasswordBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={resetLoading}>
            {resetLoading ? "Saving..." : "Update Password"}
          </Button>
        </form>
        {resetStatus && (
          <p className={`${styles.resetMessage} ${resetStatus.type === "success" ? styles.resetSuccess : styles.resetError}`}>
            {resetStatus.message}
          </p>
        )}
      </div>

      {upcomingEvents && upcomingEvents.length > 0 && (
        <div className={styles.eventsSection}>
          <h2 className={styles.eventsSectionTitle}>
            <PartyPopper size={18} />
            Upcoming Events — Schedule Notifications
          </h2>
          <div className={styles.eventsList}>
            {upcomingEvents.map((event) => (
              <div key={event.id} className={styles.eventRow}>
                <div className={styles.eventInfo}>
                  <span className={styles.eventName}>{event.title}</span>
                  <span className={styles.eventDate}>{format(new Date(event.startAt), "EEE, MMM d 'at' h:mm a")}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={notifiedEventIds.has(event.id) || scheduleEventMutation.isPending}
                  onClick={() =>
                    scheduleEventMutation.mutate(
                      { eventId: event.id },
                      {
                        onSuccess: () =>
                          setNotifiedEventIds((prev) => new Set([...prev, event.id])),
                      }
                    )
                  }
                >
                  <Bell size={14} />
                  {notifiedEventIds.has(event.id) ? "Notifications Scheduled" : "Schedule Notifications"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
