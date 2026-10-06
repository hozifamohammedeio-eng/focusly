"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import { useTheme } from "@/features/theme/theme-provider";

export function LandingControls({ ar }: { ar: boolean }) {
  const { setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        lang={ar ? "en" : "ar"}
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          setLocale(ar ? "en" : "ar");
          startTransition(() => router.refresh());
        }}
      >
        {ar ? "English" : "العربية"}
      </button>
      <label>
        <span className="sr-only">{ar ? "المظهر" : "Theme"}</span>
        <select
          value={theme}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "light" || value === "dark" || value === "system") {
              setTheme(value);
            }
          }}
        >
          <option value="system">{ar ? "النظام" : "System"}</option>
          <option value="light">{ar ? "فاتح" : "Light"}</option>
          <option value="dark">{ar ? "داكن" : "Dark"}</option>
        </select>
      </label>
    </>
  );
}
