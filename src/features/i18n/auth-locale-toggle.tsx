"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { mutate } from "@/features/planning/actions";
import { useLocale } from "@/features/i18n/locale-provider";

export function AuthLocaleToggle() {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const nextLocale = locale === "en" ? "ar" : "en";

  function changeLanguage() {
    startTransition(async () => {
      const form = new FormData();

      form.set("entity", "settings");
      form.set("action", "save");
      form.set("locale", nextLocale);

      const result = await mutate(form);

      if (result.error) {
        console.error("locale_save_failed", result.error);
        return;
      }

      setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      lang={nextLocale}
      onClick={changeLanguage}
    >
      {pending
        ? "..."
        : locale === "en"
          ? "العربية"
          : "English"}
    </Button>
  );
}