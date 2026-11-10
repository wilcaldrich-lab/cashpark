import { DISPOSABLE_DOMAINS } from "./disposable-domains";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns a short rejection reason, or null when the address can be stored. */
export function rejectEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return "Enter a valid email address.";
  }
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Enter a valid email address.";
  if (
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net" ||
    domain === "test.com" ||
    domain === "localhost" ||
    domain.endsWith(".test") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".example")
  ) {
    return "That looks like a test address.";
  }
  if (/^test([.+_\-0-9]|$)/i.test(local) || local === "testing") {
    return "That looks like a test address.";
  }
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return "Disposable email addresses are not accepted.";
  }
  return null;
}
