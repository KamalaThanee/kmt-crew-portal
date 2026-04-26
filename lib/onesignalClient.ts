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

function runWithOneSignalAsync<T>(callback: (OneSignal: any) => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    if (typeof window === "undefined" || !ONESIGNAL_APP_ID) {
      reject(new Error("OneSignal is not configured"));
      return;
    }

    const wrapped = async (OneSignal: any) => {
      try {
        resolve(await callback(OneSignal));
      } catch (error) {
        reject(error);
      }
    };

    if (window.OneSignal) {
      void wrapped(window.OneSignal);
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(wrapped);
  });
}

export function hasOneSignalConfigured() {
  return Boolean(ONESIGNAL_APP_ID);
}

export async function requestOneSignalPermission() {
  return runWithOneSignalAsync(async (OneSignal) => {
    const supported = OneSignal.Notifications.isPushSupported();
    if (!supported) {
      return {
        supported: "false",
        permission: "false",
        optedIn: "false",
        subscriptionId: "",
        message: "This browser does not support web push.",
      };
    }

    await OneSignal.User.PushSubscription.optIn();

    if (!OneSignal.Notifications.permission && OneSignal.Slidedown?.promptPush) {
      await OneSignal.Slidedown.promptPush({ force: true });
    }

    if (!OneSignal.Notifications.permission) {
      await OneSignal.Notifications.requestPermission();
    }

    if (OneSignal.Notifications.permission) {
      await OneSignal.User.PushSubscription.optIn();
    }

    return {
      supported: String(Boolean(supported)),
      permission: String(Boolean(OneSignal.Notifications.permission)),
      optedIn: String(Boolean(OneSignal.User.PushSubscription.optedIn)),
      subscriptionId: String(OneSignal.User.PushSubscription.id || ""),
      message: OneSignal.Notifications.permission
        ? "Push notifications enabled."
        : "Notification permission was not granted.",
    };
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
