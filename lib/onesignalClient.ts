"use client";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
  }
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

function runWithOneSignal(callback: (OneSignal: any) => void) {
  if (typeof window === "undefined" || !ONESIGNAL_APP_ID) return;
  if (window.OneSignal) {
    callback(window.OneSignal);
    return;
  }
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(callback);
}

export function hasOneSignalConfigured() {
  return Boolean(ONESIGNAL_APP_ID);
}

export function requestOneSignalPermission() {
  runWithOneSignal(async (OneSignal) => {
    try {
      const supported = await OneSignal.Notifications.isPushSupported();
      if (!supported) return;

      if (!OneSignal.Notifications.permission && OneSignal.Slidedown?.promptPush) {
        await OneSignal.Slidedown.promptPush({ force: true });
      }

      if (!OneSignal.Notifications.permission) {
        await OneSignal.Notifications.requestPermission();
      }

      if (OneSignal.Notifications.permission) {
        await OneSignal.User.PushSubscription.optIn();
      }
    } catch {
      // Ignore blocked or unsupported browsers during preview setup.
    }
  });
}

export function syncOneSignalUser(user: { id?: string; full_name?: string; position?: string } | null) {
  runWithOneSignal(async (OneSignal) => {
    try {
      if (!user?.id) {
        await OneSignal.logout();
        return;
      }

      await OneSignal.login(String(user.id));
      await OneSignal.User.addTags({
        crew_name: String(user.full_name || ""),
        role: String(user.position || ""),
      });

      if (OneSignal.Notifications.permission) {
        await OneSignal.User.PushSubscription.optIn();
      }
    } catch {
      // Keep app usable even if OneSignal login fails in preview.
    }
  });
}

export function clearOneSignalUser() {
  runWithOneSignal(async (OneSignal) => {
    try {
      await OneSignal.logout();
    } catch {
      // Best-effort cleanup only.
    }
  });
}

export function getOneSignalStatus(callback: (status: Record<string, string>) => void) {
  runWithOneSignal(async (OneSignal) => {
    try {
      const supported = await OneSignal.Notifications.isPushSupported();
      callback({
        supported: String(Boolean(supported)),
        permission: String(Boolean(OneSignal.Notifications.permission)),
        optedIn: String(Boolean(OneSignal.User.PushSubscription.optedIn)),
        subscriptionId: String(OneSignal.User.PushSubscription.id || ""),
        externalId: String(OneSignal.User.externalId || ""),
      });
    } catch (error: any) {
      callback({
        error: error?.message || "Unable to read OneSignal status",
      });
    }
  });
}

export async function notifyOneSignal(payload: Record<string, any>) {
  try {
    const response = await fetch("/api/onesignal/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "OneSignal notify failed");
    }

    return response.json().catch(() => ({}));
  } catch (error) {
    console.error("OneSignal notify error", error);
    return null;
  }
}
