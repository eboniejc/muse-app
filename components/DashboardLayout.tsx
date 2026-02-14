import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, GraduationCap, Menu, Music2, BookOpen, Users, Shield } from "lucide-react";
import { Button } from "./Button";
import { UserDropdown } from "./UserDropdown";
import { Sheet, SheetContent, SheetTrigger } from "./Sheet";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslation } from "react-i18next";
import { useAuth } from "../helpers/useAuth";
import styles from "./DashboardLayout.module.css";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;

  const navItems = [
    { label: t('nav.dashboard'), href: "/dashboard", icon: LayoutDashboard },
    { label: t('nav.schedule'), href: "/schedule", icon: Calendar },
    { label: t('nav.courses'), href: "/courses", icon: GraduationCap },
    { label: t('nav.ebooks'), href: "/ebooks", icon: BookOpen },
    { label: t('nav.instructors'), href: "/instructors", icon: Users },
  ];

  if (user?.role === "admin") {
    navItems.push({ label: t('nav.admin'), href: "/admin", icon: Shield });
  }

  return (
    <div className={styles.layout}>
      {/* Desktop Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logoContainer}>
          <Music2 className={styles.logoIcon} />
          <span className={styles.logoText}>MUSE INC</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        <header className={styles.header}>
          <div className={styles.mobileMenu}>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-md">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className={styles.mobileSheet}>
                <div className={styles.logoContainer}>
                  <Music2 className={styles.logoIcon} />
                  <span className={styles.logoText}>MUSE INC</span>
                </div>
                <nav className={styles.mobileNav}>
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`${styles.navItem} ${isActive ? styles.active : ""}`}
                      >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          
          <div className={styles.headerRight}>
            <div className={styles.actions}>
              <LanguageToggle />
              <UserDropdown />
            </div>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;