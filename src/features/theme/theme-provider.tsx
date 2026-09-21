"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ACCENTS, THEMES, type Accent, type Theme } from "./theme-types";

const THEME_KEY = "focusly-theme";
const ACCENT_KEY = "focusly-accent";
const THEME_EVENT = "focusly-theme-change";
const ACCENT_EVENT = "focusly-accent-change";
type ThemeContextValue = {
  theme: Theme;
  accent: Accent;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

function includes<T extends string>(
  items: readonly T[],
  value: string | null,
): value is T {
  return value !== null && items.includes(value as T);
}

function subscribeTo(eventName: string, callback: () => void) {
  const listener = (event: Event) => {
    if (event instanceof StorageEvent && event.newValue) {
      if (event.key === THEME_KEY && includes(THEMES, event.newValue))
        document.documentElement.dataset.theme = event.newValue;
      if (event.key === ACCENT_KEY && includes(ACCENTS, event.newValue))
        document.documentElement.dataset.accent = event.newValue;
    }
    callback();
  };
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(eventName, listener);
  };
}

function getThemeSnapshot(): Theme {
  const value = document.documentElement.dataset.theme ?? null;
  return includes(THEMES, value) ? value : "system";
}

function getAccentSnapshot(): Accent {
  const value = document.documentElement.dataset.accent ?? null;
  return includes(ACCENTS, value) ? value : "violet";
}

function setStoredValue<T extends string>(
  key: string,
  eventName: string,
  value: T,
) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage may be disabled; database persistence remains authoritative. */
  }
  window.dispatchEvent(new Event(eventName));
}

// Stable setters also update the root immediately, before the next React render.
function setTheme(value: Theme) {
  document.documentElement.dataset.theme = value;
  document.cookie = `focusly-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  setStoredValue(THEME_KEY, THEME_EVENT, value);
}
function setAccent(value: Accent) {
  document.documentElement.dataset.accent = value;
  document.cookie = `focusly-accent=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  setStoredValue(ACCENT_KEY, ACCENT_EVENT, value);
}

export function ThemeProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: { theme: Theme; accent: Accent };
}) {
  const theme = useSyncExternalStore<Theme>(
    (callback) => subscribeTo(THEME_EVENT, callback),
    getThemeSnapshot,
    () => initial.theme,
  );
  const accent = useSyncExternalStore<Accent>(
    (callback) => subscribeTo(ACCENT_EVENT, callback),
    getAccentSnapshot,
    () => initial.accent,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const value = useMemo(
    () => ({
      theme,
      accent,
      setTheme,
      setAccent,
    }),
    [theme, accent],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
