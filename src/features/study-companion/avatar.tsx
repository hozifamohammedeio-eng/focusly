import type { Mood } from "./model";

/** Original Focusly vector character: a rounded study lamp with expressive eyes. */
export function CompanionAvatar({ mood = "neutral", size = 52 }: { mood?: Mood; size?: number }) {
  const eyeY = mood === "thinking" ? 47 : 45;
  const smile = mood === "happy" || mood === "celebrating";
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 100 100" fill="none">
    <path d="M23 36c0-19 12-29 27-29s27 10 27 29v22c0 20-12 33-27 33S23 78 23 58V36Z"
      fill="var(--surface, #fff)" stroke="var(--foreground, #222)" strokeWidth="4" />
    <path d="M25 34c5-15 14-22 25-22s20 7 25 22" stroke="var(--accent, #8874c9)" strokeWidth="7" strokeLinecap="round" />
    <path d="M28 72c-11 1-15-3-17-8M72 72c11 1 15-3 17-8" stroke="var(--foreground, #222)" strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="40" cy={eyeY} rx="3.5" ry={mood === "celebrating" ? "2" : "4"} fill="var(--foreground, #222)" />
    <ellipse cx="60" cy={eyeY} rx="3.5" ry={mood === "celebrating" ? "2" : "4"} fill="var(--foreground, #222)" />
    {mood === "thinking" ? <path d="M45 63h11" stroke="var(--foreground, #222)" strokeWidth="3" strokeLinecap="round" />
      : mood === "reminder" ? <circle cx="50" cy="63" r="3" fill="var(--foreground, #222)" />
        : <path d={smile ? "M41 59c4 8 14 8 18 0" : "M43 61c3 4 11 4 14 0"} stroke="var(--foreground, #222)" strokeWidth="3" strokeLinecap="round" />}
    <path d="M39 90h22" stroke="var(--accent, #8874c9)" strokeWidth="5" strokeLinecap="round" />
    {mood === "celebrating" && <><circle cx="14" cy="23" r="3" fill="var(--accent, #8874c9)" /><circle cx="87" cy="26" r="3" fill="var(--accent, #8874c9)" /></>}
  </svg>;
}
