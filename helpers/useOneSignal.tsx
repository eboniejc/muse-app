import { useEffect, useRef, useState } from "react";
import OneSignal from "react-onesignal";
import { ONESIGNAL_APP_ID } from "./_publicConfigs";
import { useAuth } from "./useAuth";

export function useOneSignal() {
  const oneSignalInitialized = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { authState } = useAuth();

  useEffect(() => {
    // Only initialize once
    if (oneSignalInitialized.current) {
      return;
    }

    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true, // For development
        } as any);
        oneSignalInitialized.current = true;
        setIsInitialized(true);
        // console.log("OneSignal initialized successfully");
      } catch (err) {
        // OneSignal often fails in non-production environments or if blocked by ad-blockers
        // We log it but don't crash the app
        console.warn("OneSignal initialization failed:", err);
      }
    };

    initOneSignal();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const updateUserState = async () => {
      try {
        if (authState.type === "authenticated") {
          // Identify the user in OneSignal
          // We cast the ID to string because OneSignal expects a string external_id
          await OneSignal.login(String(authState.user.id));
        } else if (authState.type === "unauthenticated") {
          // Clear user state on logout
          await OneSignal.logout();
        }
      } catch (err) {
        console.warn("OneSignal user state update failed:", err);
      }
    };

    updateUserState();
  }, [isInitialized, authState]);
}