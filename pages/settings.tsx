import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useAuth } from "../helpers/useAuth";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import styles from "./settings.module.css";

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const { onLogin, authState } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!newEmail || !currentPassword) {
      setError("All fields are required.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/_api/user/update_email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to update email.");
        return;
      }
      if (authState.type === "authenticated") {
        onLogin({ ...authState.user, email: data.email });
      }
      setSuccess(true);
      setNewEmail("");
      setCurrentPassword("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Change Email</h2>
      <p className={styles.sectionDesc}>Current email: <strong>{currentEmail}</strong></p>
      {success && <div className={styles.successMessage}>Email updated successfully.</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>New Email</label>
          <Input
            type="email"
            placeholder="new@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Current Password</label>
          <Input
            type="password"
            placeholder="••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <><Spinner size="sm" /> Saving...</> : "Update Email"}
        </Button>
      </form>
    </div>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/_api/user/update_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to update password.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Change Password</h2>
      <p className={styles.sectionDesc}>At least 6 characters.</p>
      {success && <div className={styles.successMessage}>Password updated successfully.</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Current Password</label>
          <Input
            type="password"
            placeholder="••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>New Password</label>
          <Input
            type="password"
            placeholder="••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Confirm New Password</label>
          <Input
            type="password"
            placeholder="••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <><Spinner size="sm" /> Saving...</> : "Update Password"}
        </Button>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Account Settings - MUSE INC</title>
      </Helmet>
      <div className={styles.header}>
        <h1 className={styles.title}>Account Settings</h1>
        <p className={styles.subtitle}>Update your email and password.</p>
      </div>
      <div className={styles.sections}>
        {user && <EmailForm currentEmail={user.email} />}
        <PasswordForm />
      </div>
    </div>
  );
}
