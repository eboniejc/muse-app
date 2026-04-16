import React from "react";
import { Helmet } from "react-helmet";
import { BrandMark } from "../components/BrandMark";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";
import styles from "./login.module.css";

export default function ForgotPasswordPage() {
  return (
    <div className={styles.container}>
      <Helmet>
        <title>Forgot Password - MUSE Inc.</title>
      </Helmet>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <BrandMark size="lg" />
          </div>
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.subtitle}>Quên mật khẩu</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
