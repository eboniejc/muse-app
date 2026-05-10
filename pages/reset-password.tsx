import React from "react";
import { Helmet } from "react-helmet";
import { useSearchParams, Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { ResetPasswordForm } from "../components/ResetPasswordForm";
import styles from "./login.module.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Reset Password - MUSE Inc.</title>
      </Helmet>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <BrandMark size="lg" />
          </div>
          <h1 className={styles.title}>Set New Password</h1>
          <p className={styles.subtitle}>Đặt mật khẩu mới</p>
        </div>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div style={{ textAlign: "center", color: "var(--text-secondary, #888)", fontSize: "0.875rem" }}>
            <p>This reset link is invalid or missing.</p>
            <p>Liên kết đặt lại mật khẩu không hợp lệ hoặc bị thiếu.</p>
            <Link to="/forgot-password" style={{ color: "var(--primary, #FF6B00)" }}>
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
