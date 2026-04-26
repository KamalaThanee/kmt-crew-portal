"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasOneSignalConfigured, syncOneSignalUser } from "@/lib/onesignalClient";

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

export default function OneSignalBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !ONESIGNAL_APP_ID) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
        notifyButton: {
          enable: false,
        },
        allowLocalhostAsSecureOrigin: true,
      });

      const userStr = localStorage.getItem("kmt_user");
      const user = userStr ? JSON.parse(userStr) : null;
      if (user?.id) {
        await OneSignal.login(String(user.id));
        await OneSignal.User.addTags({
          crew_name: String(user.full_name || ""),
          role: String(user.position || ""),
        });
      }

      window.kmtOneSignalReady = true;
      window.dispatchEvent(new Event("kmt-onesignal-ready"));
    });
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
    />
  );
}
