"use client";

import { useEffect } from "react";

export type KmtTheme = "dark" | "light";

export const KMT_THEME_KEY = "kmt_theme";

export function getStoredTheme(): KmtTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(KMT_THEME_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: KmtTheme) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  window.localStorage.setItem(KMT_THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent<KmtTheme>("kmt-theme-changed", { detail: theme }));
}

export default function ThemeBridge() {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return null;
}
