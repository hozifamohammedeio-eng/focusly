"use client";
import { useLocale } from "./locale-provider";
import { phase2 } from "./phase2";
export function useCopy() {
  return phase2[useLocale().locale];
}
