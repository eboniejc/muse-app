import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import styles from "./ForgotPasswordForm.module.css";

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/_api/auth/forgot_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      } else {
        setError("No account found with that email address.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!resetUrl) return;
    navigator.clipboard.writeText(resetUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (resetUrl) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>✓</div>
        <h2 className={styles.successTitle}>Reset link ready</h2>
        <p className={styles.successText}>
          Copy this link and send it to the student via WhatsApp or Zalo. It expires in <strong>1 hour</strong>.
        </p>
        <p className={styles.successTextVi}>
          Sao chép liên kết này và gửi cho học viên qua WhatsApp hoặc Zalo. Liên kết hết hạn sau <strong>1 giờ</strong>.
        </p>
        <div className={styles.linkBox}>
          <span className={styles.linkText}>{resetUrl}</span>
        </div>
        <button onClick={handleCopy} className={styles.copyButton}>
          {copied ? "Copied!" : "Copy link"}
        </button>
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
