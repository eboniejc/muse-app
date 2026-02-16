import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Music2, ArrowRight } from "lucide-react";
import { RegistrationForm } from "../components/RegistrationForm";
import { Button } from "../components/Button";
import styles from "./complete-registration.module.css";

export default function CompleteRegistrationPage() {
  return (
    <div className={styles.pageWrapper}>
      <Helmet>
        <title>Complete Registration - MUSE INC</title>
      </Helmet>

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <Music2 className={styles.logoIcon} />
          <span className={styles.logoText}>MUSE INC</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.contentContainer}>
          <div className={styles.intro}>
            <h1 className={styles.title}>Complete Your Registration</h1>
            <p className={styles.subtitle}>
              Please fill in your details to start your DJ journey with MUSE Inc.
            </p>
          </div>

          <RegistrationForm />

          <div className={styles.footer}>
            <Button variant="link" asChild className={styles.skipLink}>
              <Link to="/dashboard">
                Skip for now <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}