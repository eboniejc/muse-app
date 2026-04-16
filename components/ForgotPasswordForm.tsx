import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import styles from "./ForgotPasswordForm.module.css";

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      await fetch("/_api/auth/forgot_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>✓</div>
        <h2 className={styles.successTitle}>Check your email</h2>
        <p className={styles.successText}>
          If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your inbox (and spam folder).
        </p>
        <p className={styles.successTextVi}>
          Nếu tài khoản tồn tại với email <strong>{email}</strong>, chúng tôi đã gửi liên kết đặt lại mật khẩu. Kiểm tra hộp thư đến (và thư rác) của bạn.
        </p>
        <Link to="/login" className={styles.backLink}>← Back to login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <p className={styles.description}>
        Enter your email and we'll send you a link to reset your password.
      </p>
      <p className={styles.descriptionVi}>
        Nhập email của bạn và chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
      </p>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.field}>
        <label className={styles.label}>Email</label>
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <Button type="submit" disabled={isLoading || !email.trim()} className={styles.submitButton}>
        {isLoading ? (
          <span className={styles.loadingText}>
            <Spinner size="sm" className={styles.spinner} />
            Sending...
          </span>
        ) : (
          "Send Reset Link"
        )}
      </Button>

      <Link to="/login" className={styles.backLink}>← Back to login</Link>
    </form>
  );
};
