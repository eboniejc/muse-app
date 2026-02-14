import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import { OAuthButtonGroup } from "../components/OAuthButtonGroup";
import { LanguageToggle } from "../components/LanguageToggle";
import { useAuth } from "../helpers/useAuth";
import { Music2 } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab =
    searchParams.get("tab") === "register" ? "register" : "login";

  // Redirect if already logged in
  useEffect(() => {
    if (authState.type === "authenticated") {
      navigate("/dashboard", { replace: true });
    }
  }, [authState, navigate]);

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Login - MUSE Inc.</title>
      </Helmet>

      <div className={styles.card}>
        <div className={styles.languageToggle}>
          <LanguageToggle />
        </div>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Music2 size={32} />
          </div>
          <h1 className={styles.title}>{t("auth.loginTitle")}</h1>
          <p className={styles.subtitle}>{t("auth.loginSubtitle")}</p>
        </div>

        <Tabs defaultValue={defaultTab} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="login" className={styles.tabTrigger}>
              {t("nav.login")}
            </TabsTrigger>
            <TabsTrigger value="register" className={styles.tabTrigger}>
              {t("nav.register")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className={styles.content}>
            <OAuthButtonGroup className={styles.oauth} />

            <div className={styles.separator}>
              <span className={styles.separatorText}>{t("common.or")}</span>
            </div>

            <PasswordLoginForm />
          </TabsContent>

          <TabsContent value="register" className={styles.content}>
            <PasswordRegisterForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}