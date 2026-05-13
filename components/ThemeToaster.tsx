"use client";

import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { getStoredTheme, type KmtTheme } from "@/components/ThemeBridge";

export default function ThemeToaster() {
  const [theme, setTheme] = useState<KmtTheme>("light");

  useEffect(() => {
    const syncTheme = () => setTheme(getStoredTheme());
    syncTheme();
    window.addEventListener("kmt-theme-changed", syncTheme);

    return () => window.removeEventListener("kmt-theme-changed", syncTheme);
  }, []);

  return <Toaster closeButton position="top-center" expand={false} richColors theme={theme} />;
}
