import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "button-primary border-transparent bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-85",
  secondary:
    "button-secondary border-[var(--foreground)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-subtle)]",
  ghost:
    "button-ghost border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-subtle)]",
};

const base =
  "focusly-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant };

export function ButtonLink({
  className = "",
  href,
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={`${base} ${styles[variant]} ${className}`}
      href={href}
      {...props}
    />
  );
}
