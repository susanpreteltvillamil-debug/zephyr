import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { LEGAL_SLUGS } from "@/lib/data/public";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.siteUrl;
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/reservar`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...LEGAL_SLUGS.map((slug) => ({
      url: `${base}/legal/${slug}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
