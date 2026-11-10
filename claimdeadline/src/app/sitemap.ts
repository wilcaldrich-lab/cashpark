import type { MetadataRoute } from "next";
import { seedSettlements } from "@/lib/seed";
import { listSettlements } from "@/lib/settlements";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  let settlements = seedSettlements();
  try {
    settlements = (await listSettlements()).settlements;
  } catch {
    settlements = seedSettlements();
  }
  const staticRoutes = ["", "/new", "/submit", "/sponsor"].map((path) => ({
    url: `${base}${path || "/"}`,
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.6,
  }));
  const details = settlements.map((settlement) => ({
    url: `${base}/settlement/${settlement.slug}`,
    lastModified: settlement.publishedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [...staticRoutes, ...details];
}
