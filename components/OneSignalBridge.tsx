"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasOneSignalConfigured, syncOneSignalUser } from "@/lib/onesignalClient";

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

export default function OneSignalBridge() {
  const pathname = usePathname();

  const initializeOneSignal = () => {
    if (typeof window === "undefined" || !ONESIGNAL_APP_ID) return;
    if (window.kmtOneSignalReady || window.kmtOneSignalInitStarted) return;

    window.kmtOneSignalInitStarted = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
          notifyButton: {
            enable: false,
          },
          autoResubscribe: true,
          allowLocalhostAsSecureOrigin: true,
        });

        window.kmtOneSignalReady = true;
        window.kmtOneSignalInitError = "";
        window.dispatchEvent(new Event("kmt-onesignal-ready"));

        const userStr = localStorage.getItem("kmt_user");
        const user = userStr ? JSON.parse(userStr) : null;
        if (user?.id) {
          await OneSignal.login(String(user.id));
          await OneSignal.User.addTags({
            crew_name: String(user.full_name || ""),
            role: String(user.position || ""),
          });
        }
      } catch (error: any) {
        window.kmtOneSignalInitError = error?.message || "OneSignal init failed";
        window.kmtOneSignalInitStarted = false;
        window.dispatchEvent(new Event("kmt-onesignal-error"));
      }
    });
  };

  useEffect(() => {
    initializeOneSignal();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasOneSignalConfigured()) return;

    const syncFromStorage = () => {
      const userStr = localStorage.getItem("kmt_user");
      const user = userStr ? JSON.parse(userStr) : null;
      syncOneSignalUser(user);
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "kmt_user") {
        syncFromStorage();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncFromStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, [pathname]);

  if (!ONESIGNAL_APP_ID) return null;

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
      onReady={initializeOneSignal}
      onError={() => {
        window.kmtOneSignalInitError = "Unable to load OneSignal SDK script";
        window.dispatchEvent(new Event("kmt-onesignal-error"));
      }}
    />
  );
}
