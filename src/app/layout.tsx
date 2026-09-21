import { getStudent } from "@/features/auth/session";
import { cookies } from "next/headers";
import {
  ACCENTS,
  THEMES,
  type Accent,
  type Theme,
} from "@/features/theme/theme-types";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

const inter = localFont({
  src: "./fonts/Inter.ttf",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});
const editorial = localFont({
  src: "./fonts/SourceSerif4.ttf",
  variable: "--font-editorial",
  display: "swap",
  weight: "200 900",
});
const cairo = localFont({
  src: "./fonts/Cairo.ttf",
  variable: "--font-cairo",
  display: "swap",
  weight: "200 1000",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Focusly",
    template: "%s · Focusly",
  },
  description: "A calm study workspace for focused students.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17191c" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const student = await getStudent();
  const preferences = await cookies();
  const guestTheme = preferences.get("focusly-theme")?.value as Theme;
  const guestAccent = preferences.get("focusly-accent")?.value as Accent;
  const initial =
    student.kind === "authenticated"
      ? student.settings
      : {
          theme: THEMES.includes(guestTheme) ? guestTheme : ("system" as const),
          accent: ACCENTS.includes(guestAccent)
            ? guestAccent
            : ("violet" as const),
          locale:
            preferences.get("focusly-locale")?.value === "ar"
              ? ("ar" as const)
              : ("en" as const),
        };
  return (
    <html
      lang={initial.locale}
      className={`${inter.variable} ${editorial.variable} ${cairo.variable}`}
      dir={initial.locale === "ar" ? "rtl" : "ltr"}
      data-theme={initial.theme}
      data-accent={initial.accent}
      suppressHydrationWarning
    >
      <body>
        <AppProviders initial={initial}>{children}</AppProviders>
      </body>
    </html>
  );
}
