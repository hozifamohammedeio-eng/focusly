import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLElement> & { variant?: "neutral" | "paper" | "accent" | "floating" }) {
  return <section className={`surface card-${variant} p-6 ${className}`} {...props} />;
}
