import { getSettings } from "@/features/auth/session";
import { cookies } from "next/headers";

import {
  ACCENTS,
  THEMES,
  type Accent,
  type Theme,
} from "@/features/theme/theme-types";

import type {
  Metadata,
  Viewport,
} from "next";

import type {
  ReactNode,
} from "react";

import {
  Alexandria,
  Manrope,
} from "next/font/google";

import {
  AppProviders,
} from "@/components/providers/app-providers";

import "./globals.css";

/*
 * Focusly Typography
 *
 * English:
 * Manrope
 *
 * Arabic:
 * Alexandria
 *
 * Both are variable fonts and are handled
 * through Next.js font optimization.
 */

const manrope =
  Manrope({
    subsets: [
      "latin",
    ],

    variable:
      "--font-focusly-en",

    display:
      "swap",
  });

const alexandria =
  Alexandria({
    subsets: [
      "arabic",
      "latin",
    ],

    variable:
      "--font-focusly-ar",

    display:
      "swap",
  });

export const metadata:
  Metadata = {
    title: {
      default:
        "Focusly",

      template:
        "%s · Focusly",
    },

    description:
      "A calm study workspace for focused students.",
  };

export const viewport:
  Viewport = {
    colorScheme:
      "light dark",

    themeColor: [
      {
        media:
          "(prefers-color-scheme: light)",

        color:
          "#ffffff",
      },

      {
        media:
          "(prefers-color-scheme: dark)",

        color:
          "#17191c",
      },
    ],
  };

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const student =
    await getSettings();

  const preferences =
    await cookies();

  const guestTheme =
    preferences
      .get(
        "focusly-theme",
      )
      ?.value as Theme;

  const guestAccent =
    preferences
      .get(
        "focusly-accent",
      )
      ?.value as Accent;

  const initial =
    student.kind ===
    "authenticated"
      ? student.settings
      : {
          theme:
            THEMES.includes(
              guestTheme,
            )
              ? guestTheme
              : (
                  "system" as const
                ),

          accent:
            ACCENTS.includes(
              guestAccent,
            )
              ? guestAccent
              : (
                  "violet" as const
                ),

          locale:
            preferences
              .get(
                "focusly-locale",
              )
              ?.value ===
            "ar"
              ? (
                  "ar" as const
                )
              : (
                  "en" as const
                ),
        };

  return (
    <html
      lang={
        initial.locale
      }
      dir={
        initial.locale ===
        "ar"
          ? "rtl"
          : "ltr"
      }
      className={
        manrope.variable +
        " " +
        alexandria.variable
      }
      data-theme={
        initial.theme
      }
      data-accent={
        initial.accent
      }
      suppressHydrationWarning
    >
      <body>
        <AppProviders
          initial={
            initial
          }
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
