"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { messages, type Locale } from "./messages";

const STORAGE_KEY = "focusly-locale";
const CHANGE_EVENT = "focusly-locale-change";
type LocaleContextValue = {
  locale: Locale;
  messages: (typeof messages)[Locale];
  setLocale: (locale: Locale) => void;
};
const LocaleContext = createContext<LocaleContextValue | null>(null);

function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (
      event.key === STORAGE_KEY &&
      (event.newValue === "ar" || event.newValue === "en")
    ) {
      document.documentElement.lang = event.newValue;
      document.documentElement.dir = event.newValue === "ar" ? "rtl" : "ltr";
      callback();
    }
  };
  window.addEventListener("storage", storage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getLocaleSnapshot(): Locale {
  return document.documentElement.lang === "ar" ? "ar" : "en";
}

function setStoredLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.cookie = `focusly-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* Browser storage is optional. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function LocaleProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: Locale;
}) {
  const locale = useSyncExternalStore<Locale>(
    subscribe,
    getLocaleSnapshot,
    () => initial,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo(
    () => ({ locale, messages: messages[locale], setLocale: setStoredLocale }),
    [locale],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context)
    throw new Error("useLocale must be used inside LocaleProvider.");
  return context;
}
