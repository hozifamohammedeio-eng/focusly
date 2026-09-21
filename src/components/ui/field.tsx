import type { InputHTMLAttributes } from "react";
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string | undefined;
};
export function Field({ label, hint, id, name, ...props }: Props) {
  const fieldId = id ?? name;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor={fieldId}>
        {label}
      </label>
      <input
        className="field"
        id={fieldId}
        name={name}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
      {hint && (
        <p className="muted text-xs" id={`${fieldId}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
