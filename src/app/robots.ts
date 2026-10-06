import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/app", "/auth/", "/onboarding", "/reset-password", "/confirm-email"] }, sitemap: "https://focusly-beige.vercel.app/sitemap.xml" };
}
