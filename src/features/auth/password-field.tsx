"use client";
import { useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";

export function PasswordField({ name, label, fresh = false, hint }: {
  name: string; label: string; fresh?: boolean; hint?: string | undefined;
}) {
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const ar = locale === "ar";
  return <div className="grid gap-2">
    <label className="text-sm font-semibold" htmlFor={name}>{label}</label>
    <div className="auth-password">
      <input className="field" id={name} name={name} dir="ltr" required
        type={visible ? "text" : "password"} minLength={fresh ? 8 : 1} maxLength={128}
        autoComplete={fresh ? "new-password" : "current-password"}
        aria-describedby={[hint ? `${name}-hint` : "", caps ? `${name}-caps` : ""].filter(Boolean).join(" ") || undefined}
        onKeyUp={event => setCaps(event.getModifierState("CapsLock"))}
        onKeyDown={event => setCaps(event.getModifierState("CapsLock"))} onBlur={() => setCaps(false)} />
      <button type="button" aria-controls={name} aria-pressed={visible}
        aria-label={ar ? "إظهار كلمة السر" : "Show password"} onClick={() => setVisible(value => !value)}>
        {visible ? ar ? "إخفاء" : "Hide" : ar ? "إظهار" : "Show"}
      </button>
    </div>
    {hint && <p id={`${name}-hint`} className="muted text-xs leading-5">{hint}</p>}
    {caps && <p id={`${name}-caps`} role="status" className="muted text-xs">{ar ? "Caps Lock مفعّل" : "Caps Lock is on"}</p>}
  </div>;
}
