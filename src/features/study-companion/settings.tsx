"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/features/i18n/locale-provider";
import { companionBootstrap, saveCompanionName, saveCompanionPreferences } from "./actions";
import { companionCopy } from "./copy";
import { validCompanionName, type CompanionPreference } from "./model";

export function CompanionSettings() {
  const { locale } = useLocale();
  const t = companionCopy[locale];
  const [value, setValue] = useState<CompanionPreference | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    let active = true;
    void companionBootstrap().then(result => {
      if (!active || !result.ok || !result.value.preference) return;
      setValue(result.value.preference);
      setName(result.value.preference.companion_name);
    });
    return () => { active = false; };
  }, []);
  if (!value) return null;
  function save() {
    if (!value || !validCompanionName(name)) { setStatus("error"); return; }
    start(async () => {
      const preferences = await saveCompanionPreferences(value.enabled, value.auto_greeting_enabled);
      const naming = name.trim() === value.companion_name ? null : await saveCompanionName(name);
      if (!preferences.ok || naming && !naming.ok) { setStatus("error"); return; }
      setValue({ ...value, companion_name: name.trim() });
      setStatus("saved");
      window.dispatchEvent(new Event("focusly-companion-settings"));
    });
  }
  return <Card>
    <h2 className="mb-4 text-lg font-semibold">{locale === "ar" ? "رفيق المذاكرة" : "Study companion"}</h2>
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold">{t.nameLabel}
        <input className="field" value={name} onChange={event => setName(event.target.value)} maxLength={40} dir="auto" />
      </label>
      <label className="choice"><input type="checkbox" checked={value.enabled}
        onChange={event => setValue({ ...value, enabled: event.target.checked })} />{t.enabled}</label>
      <label className="choice"><input type="checkbox" checked={value.auto_greeting_enabled}
        onChange={event => setValue({ ...value, auto_greeting_enabled: event.target.checked })} />{t.showWhenOpen}</label>
      <div><Button type="button" onClick={save} disabled={pending || !validCompanionName(name)}>{pending ? t.loading : t.save}</Button></div>
      {status && <p role="status" className={status === "error" ? "form-error" : "muted"}>{status === "saved" ? t.saved : t.tryAgain}</p>}
    </div>
  </Card>;
}
