"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  mutate,
} from "@/features/planning/actions";

import {
  useTheme,
} from "@/features/theme/theme-provider";

import {
  useLocale,
} from "@/features/i18n/locale-provider";

import styles from "./quick-theme-switcher.module.css";

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="3.7"
      />

      <path d="M12 2.5v2" />
      <path d="M12 19.5v2" />
      <path d="m5.28 5.28 1.42 1.42" />
      <path d="m17.3 17.3 1.42 1.42" />
      <path d="M2.5 12h2" />
      <path d="M19.5 12h2" />
      <path d="m5.28 18.72 1.42-1.42" />
      <path d="m17.3 6.7 1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20.2 15.15A8.3 8.3 0 0 1 8.85 3.8 8.55 8.55 0 1 0 20.2 15.15Z"
      />
    </svg>
  );
}

export function QuickThemeSwitcher() {
  const {
    theme,
    setTheme,
  } = useTheme();

  const {
    locale,
  } = useLocale();

  const router =
    useRouter();

  const [
    systemDark,
    setSystemDark,
  ] = useState(false);

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    failed,
    setFailed,
  ] = useState(false);

  useEffect(() => {
    const media =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      );

    const update = () => {
      setSystemDark(
        media.matches,
      );
    };

    update();

    media.addEventListener(
      "change",
      update,
    );

    return () => {
      media.removeEventListener(
        "change",
        update,
      );
    };
  }, []);

  const isDark =
    theme === "dark" ||
    (
      theme === "system" &&
      systemDark
    );

  const label =
    locale === "ar"
      ? isDark
        ? "التبديل إلى الوضع الفاتح"
        : "التبديل إلى الوضع الداكن"
      : isDark
        ? "Switch to light mode"
        : "Switch to dark mode";

  function handleToggle() {
    if (pending) {
      return;
    }

    const previous =
      theme;

    const next =
      isDark
        ? "light"
        : "dark";

    setFailed(false);

    /*
     * Immediate optimistic UI update.
     * No waiting for the server.
     */
    setTheme(next);

    const form =
      new FormData();

    form.set(
      "entity",
      "settings",
    );

    form.set(
      "action",
      "save",
    );

    form.set(
      "theme",
      next,
    );

    startTransition(
      async () => {
        try {
          const response =
            await mutate(
              form,
            );

          if (
            response.error
          ) {
            setTheme(
              previous,
            );

            setFailed(true);

            return;
          }

          router.refresh();
        } catch {
          setTheme(
            previous,
          );

          setFailed(true);
        }
      },
    );
  }

  return (
    <div
      className={
        styles.wrapper
      }
    >
      <button
        type="button"
        className={[
          styles.toggle,
          isDark
            ? styles.dark
            : styles.light,
          pending
            ? styles.pending
            : "",
          failed
            ? styles.failed
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={
          handleToggle
        }
        aria-label={
          label
        }
        title={
          label
        }
        aria-pressed={
          isDark
        }
        disabled={
          pending
        }
      >
        <span
          className={
            styles.glassHighlight
          }
          aria-hidden="true"
        />

        <span
          className={
            styles.ambientGlow
          }
          aria-hidden="true"
        />

        <span
          className={[
            styles.iconSlot,
            styles.sunSlot,
          ].join(" ")}
          aria-hidden="true"
        >
          <SunIcon />
        </span>

        <span
          className={[
            styles.iconSlot,
            styles.moonSlot,
          ].join(" ")}
          aria-hidden="true"
        >
          <MoonIcon />
        </span>

        <span
          className={
            styles.thumb
          }
          aria-hidden="true"
        >
          <span
            className={
              styles.thumbGlow
            }
          />

          <span
            className={
              styles.thumbIcon
            }
          >
            {isDark ? (
              <MoonIcon />
            ) : (
              <SunIcon />
            )}
          </span>
        </span>
      </button>

      <span
        className="sr-only"
        role="status"
        aria-live="polite"
      >
        {failed
          ? locale ===
            "ar"
            ? "تعذر حفظ المظهر."
            : "Could not save theme."
          : ""}
      </span>
    </div>
  );
}
