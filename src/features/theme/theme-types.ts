export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const ACCENTS = ["violet", "blue", "green", "orange"] as const;
export type Accent = (typeof ACCENTS)[number];
