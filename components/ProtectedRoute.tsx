import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { User } from "../helpers/User";
import { AuthErrorPage } from "./AuthErrorPage";
import { ShieldOff } from "lucide-react";
import { AuthLoadingState } from "./AuthLoadingState";
import styles from "./ProtectedRoute.module.css";

// Do not use this in pageLayout
const MakeProtectedRoute: (roles: User["role"][]) => React.FC<{
  children: React.ReactNode;
}> =
  (roles) =>
  ({ children }) => {
    const { authState } = useAuth();

    // Show loading state while checking authentication
    if (authState.type === "loading") {
      return <AuthLoadingState title="Authenticating" />;
    }

    // Redirect to login if not authenticated
    if (authState.type === "unauthenticated") {
      return <Navigate to="/login" replace />;
    }

    if (!roles.includes(authState.user.role)) {
      return (
        <AuthErrorPage
          title="Access Denied"
          message={`Access denied. Your role (${authState.user.role}) lacks required permissions.`}
          icon={<ShieldOff className={styles.accessDeniedIcon} size={64} />}
        />
      );
    }

    // Render children if authenticated
    return <>{children}</>;
  };

// Create protected routes here, then import them in pageLayout
export const AdminRoute = MakeProtectedRoute(["admin"]);
export const InstructorRoute = MakeProtectedRoute(["instructor", "admin"]);
export const UserRoute = MakeProtectedRoute(["user", "instructor", "admin"]);

const ADMIN_PASSWORD = "DJmuse26";
const SESSION_KEY = "adminUnlocked";

export const AdminPasswordGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "true");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setUnlocked(true);
    } else {
      setError(true);
      setInput("");
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className={styles.passwordGate}>
      <form onSubmit={handleSubmit} className={styles.passwordForm}>
        <div className={styles.passwordLockIcon}>🔒</div>
        <h2 className={styles.passwordTitle}>Admin Access</h2>
        <input
          type="password"
          placeholder="Enter password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          className={styles.passwordInput}
          autoFocus
        />
        {error && <p className={styles.passwordError}>Incorrect password</p>}
        <button type="submit" className={styles.passwordButton}>Unlock</button>
      </form>
    </div>
  );
};
