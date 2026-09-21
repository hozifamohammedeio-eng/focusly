"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/features/i18n/locale-provider";
import { useTheme } from "@/features/theme/theme-provider";
import { ACCENTS, THEMES } from "@/features/theme/theme-types";

const foundations = ["localization", "themes", "supabase"] as const;

export function AppShell() {
  const { locale, messages, setLocale } = useLocale();
  const { accent, setAccent, setTheme, theme } = useTheme();

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
      <header className="surface flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Link
          className="text-xl font-semibold tracking-[-0.04em]"
          href="/"
          aria-label="Focusly home"
        >
          focusly<span style={{ color: "var(--accent)" }}>.</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          >
            {locale === "en" ? "العربية" : "English"}
          </Button>
          <label className="sr-only" htmlFor="theme-select">
            {messages.shell.theme}
          </label>
          <select
            id="theme-select"
            className="h-10 rounded-full border bg-transparent px-3 text-sm"
            value={theme}
            onChange={(event) =>
              setTheme(event.target.value as (typeof THEMES)[number])
            }
          >
            {THEMES.map((item) => (
              <option key={item} value={item}>
                {messages.theme[item]}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="grid gap-5 py-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="surface overflow-hidden p-7 sm:p-10 lg:min-h-[34rem] lg:p-14">
          <Badge>{messages.shell.phase}</Badge>
          <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl">
            {messages.shell.title}
          </h1>
          <p className="muted mt-6 max-w-2xl text-base leading-8 sm:text-lg">
            {messages.shell.description}
          </p>
          <div
            className="mt-10 flex flex-wrap gap-2"
            aria-label={messages.shell.accent}
          >
            {ACCENTS.map((item) => (
              <button
                key={item}
                aria-label={`${messages.shell.accent}: ${messages.accent[item]}`}
                aria-pressed={accent === item}
                className="grid size-11 place-items-center rounded-full border transition-transform hover:scale-105"
                onClick={() => setAccent(item)}
                type="button"
              >
                <span
                  className="size-5 rounded-full"
                  style={{ background: `var(--accent-${item})` }}
                />
              </button>
            ))}
          </div>
        </section>

        <aside className="grid gap-5">
          <Card>
            <p className="eyebrow">{messages.shell.foundation}</p>
            <div className="mt-5 grid gap-3">
              {foundations.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-subtle)] px-4 py-3"
                  key={item}
                >
                  <span className="text-sm font-medium">
                    {messages.foundation[item]}
                  </span>
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-[var(--accent)]"
                  />
                </div>
              ))}
            </div>
          </Card>
          <Card className="flex flex-col justify-between">
            <div>
              <p className="eyebrow">{messages.shell.next}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                {messages.shell.nextTitle}
              </h2>
            </div>
            <p className="muted mt-8 text-sm leading-6">
              {messages.shell.nextDescription}
            </p>
          </Card>
        </aside>
      </main>
    </div>
  );
}
