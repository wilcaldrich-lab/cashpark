export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "http://localhost:3000";
}

export const SITE_NAME = "ClaimDeadline";

export const SITE_DESCRIPTION =
  "Free tracker of open US class action settlements, sorted by claim deadline. Filing is always free on the official settlement site.";

export const FREE_FILING_NOTE =
  "Filing is always free on the official settlement site. Never pay anyone to file.";

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "settlement";
}
