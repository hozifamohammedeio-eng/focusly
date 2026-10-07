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
    images: [{ url: "https://focusly-beige.vercel.app/opengraph-image", width: 1200, height: 630, alt: "Focusly — Study, progress, and build your city" }],
  },
  twitter: { card: "summary_large_image", title: "Focusly — Your study life, beautifully organized", images: ["https://focusly-beige.vercel.app/opengraph-image"] },
};

export default function HomePage() {
  return <>
    {process.env.NODE_ENV === "development" && <div style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 99999, padding: "8px", background: "#ffeb00", color: "#000", fontWeight: 800, textAlign: "center", pointerEvents: "none" }}>FOCUSLY V2 TEST</div>}
    <Landing />
  </>;
}
