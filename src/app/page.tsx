import { Landing } from "@/features/landing/landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Focusly — Your study life, beautifully organized",
  description: "A study organization app for students: tasks, weekly planning, calendar, focus timer, AI Weekly Planner, Study Companion, goals, and progress. In Arabic and English.",
  alternates: { canonical: "https://focusly-beige.vercel.app/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Focusly — Your study life, beautifully organized",
    description: "Plan smarter, stay focused, and turn study goals into real progress. Available in Arabic and English.",
    url: "https://focusly-beige.vercel.app/", siteName: "Focusly", type: "website",
    images: [{ url: "https://focusly-beige.vercel.app/icon-512.png", width: 512, height: 512, alt: "Focusly" }],
  },
};

export default function HomePage() {
  return <Landing />;
}
