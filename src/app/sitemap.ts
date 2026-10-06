import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://focusly-beige.vercel.app/", changeFrequency: "monthly", priority: 1 }];
}
