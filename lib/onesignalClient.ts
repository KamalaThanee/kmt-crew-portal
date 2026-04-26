"use client";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    kmtOneSignalInitError?: string;
    kmtOneSignalInitStarted?: boolean;
    kmtOneSignalReady?: boolean;
  }
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

function runWithOneSignal(callback: (OneSignal: any) => void) {
  if (typeof window === "undefined" || !ONESIGNAL_APP_ID) return;
  if (window.OneSignal && window.kmtOneSignalReady) {
    callback(window.OneSignal);
    return;
  }
  waitForOneSignalReady()
    .then(() => {
      if (window.OneSignal) callback(window.OneSignal);
    })
    .catch(() => undefined);
}

function waitForOneSignalReady() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OneSignal is not available outside the browser"));
      return;
    }

    if (window.kmtOneSignalReady) {
      resolve();
      return;
    }

    if (window.kmtOneSignalInitError) {
      reject(new Error(window.kmtOneSignalInitError));
      return;
    }

    const timeout = window.setTimeout(() => {
      window.removeEventListener("kmt-onesignal-ready", handleReady);
      window.removeEventListener("kmt-onesignal-error", handleError);
      reject(new Error(window.kmtOneSignalInitError || "OneSignal init timed out"));
    }, 10000);

    const handleReady = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("kmt-onesignal-ready", handleReady);
      window.removeEventListener("kmt-onesignal-error", handleError);
      resolve();
    };

    const handleError = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("kmt-onesignal-ready", handleReady);
      window.removeEventListener("kmt-onesignal-error", handleError);
      reject(new Error(window.kmtOneSignalInitError || "OneSignal init failed"));
    };

    window.addEventListener("kmt-onesignal-ready", handleReady);
    window.addEventListener("kmt-onesignal-error", handleError);
  });
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

    if (window.OneSignal && window.kmtOneSignalReady) {
      void wrapped(window.OneSignal);
      return;
    }

    waitForOneSignalReady()
      .then(() => {
        if (!window.OneSignal) {
          throw new Error("OneSignal SDK is not loaded");
        }
        return wrapped(window.OneSignal);
      })
      .catch(reject);
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
        nativePermission:
          typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "unsupported",
        message: "This browser does not support web push.",
      };
    }

    const nativePermission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported";

    if (nativePermission === "default" && "Notification" in window) {
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        return {
          supported: String(Boolean(supported)),
          permission: "false",
          optedIn: String(Boolean(OneSignal.User.PushSubscription.optedIn)),
          subscriptionId: String(OneSignal.User.PushSubscription.id || ""),
          nativePermission: result,
          message: `Notification permission is ${result}.`,
        };
      }
    }

    if (nativePermission === "denied") {
      return {
        supported: String(Boolean(supported)),
        permission: "false",
        optedIn: "false",
        subscriptionId: "",
        nativePermission,
        message: "Notifications are blocked in browser site settings.",
      };
    }

    await Promise.race([
      OneSignal.User.PushSubscription.optIn(),
      new Promise((_, reject) =>
        window.setTimeout(() => reject(new Error("OneSignal opt-in timed out")), 7000),
      ),
    ]);

    if (OneSignal.Notifications.permission) {
      await OneSignal.User.PushSubscription.optIn();
    } else if (OneSignal.Slidedown?.promptPush) {
      await OneSignal.Slidedown.promptPush({ force: true });
    }

    return {
      supported: String(Boolean(supported)),
      permission: String(Boolean(OneSignal.Notifications.permission)),
      optedIn: String(Boolean(OneSignal.User.PushSubscription.optedIn)),
      subscriptionId: String(OneSignal.User.PushSubscription.id || ""),
      nativePermission:
        typeof window !== "undefined" && "Notification" in window
          ? Notification.permission
          : "unsupported",
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
        initReady: String(Boolean(window.kmtOneSignalReady)),
        initError: String(window.kmtOneSignalInitError || ""),
        permission: String(Boolean(OneSignal.Notifications.permission)),
        optedIn: String(Boolean(OneSignal.User.PushSubscription.optedIn)),
        subscriptionId: String(OneSignal.User.PushSubscription.id || ""),
        externalId: String(OneSignal.User.externalId || ""),
        nativePermission:
          typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "unsupported",
      });
    } catch (error: any) {
      callback({
        initReady: String(Boolean(window.kmtOneSignalReady)),
        initError: String(window.kmtOneSignalInitError || ""),
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
