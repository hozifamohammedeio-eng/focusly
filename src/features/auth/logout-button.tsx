"use client";
import { useActionState } from "react";
import { logout } from "./actions";
import { useCopy } from "@/features/i18n/use-copy";
import { Button } from "@/components/ui/button";
export function LogoutButton() {
  const t = useCopy();
  const [state, action, pending] = useActionState(logout, {});
  return (
    <form action={action}>
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? t.working : t.logout}
      </Button>
      {state.error && (
        <p className="form-error" role="alert">
          {t.errors[state.error]}
        </p>
      )}
    </form>
  );
}
