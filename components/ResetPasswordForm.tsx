import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import styles from "./ResetPasswordForm.module.css";

interface ResetPasswordFormProps {
  token: string;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/_api/auth/reset_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to reset password. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>✓</div>
        <h2 className={styles.successTitle}>Password updated!</h2>
        <p className={styles.successText}>
          Your password has been reset. Redirecting you to login...
        </p>
        <p className={styles.successTextVi}>
          Mật khẩu của bạn đã được đặt lại. Đang chuyển đến trang đăng nhập...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <p className={styles.description}>Enter your new password below.</p>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.field}>
        <label className={styles.label}>New password</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Confirm new password</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
          required
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || !password || !confirm}
        className={styles.submitButton}
      >
        {isLoading ? (
          <span className={styles.loadingText}>
            <Spinner size="sm" className={styles.spinner} />
            Updating...
          </span>
        ) : (
          "Set New Password"
        )}
      </Button>
    </form>
  );
};
