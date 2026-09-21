"use client";

import type { ReactNode } from "react";

import { LocaleProvider } from "@/features/i18n/locale-provider";
import { ThemeProvider } from "@/features/theme/theme-provider";

export function AppProviders({
  children,
  initial,
}: {
  children: ReactNode;
  initial: {
    theme: import("@/features/theme/theme-types").Theme;
    accent: import("@/features/theme/theme-types").Accent;
    locale: "en" | "ar";
  };
}) {
  return (
    <ThemeProvider initial={initial}>
      <LocaleProvider initial={initial.locale}>{children}</LocaleProvider>
    </ThemeProvider>
  );
}
