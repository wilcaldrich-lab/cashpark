import { logError } from "./db";

type ResendResult = { ok: true } | { ok: false; skipped?: boolean; detail: string };

export async function addToResendAudience(email: string): Promise<ResendResult> {
  const key = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!key || !audienceId) {
    return { ok: false, skipped: true, detail: "Resend audience is not configured." };
  }

  const legacy = await fetch(
    `https://api.resend.com/audiences/${encodeURIComponent(audienceId)}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    },
  );
  if (legacy.ok || legacy.status === 409) return { ok: true };

  const legacyBody = await legacy.text();
  if (legacy.status !== 404 && legacy.status !== 405) {
    await logError("resend", "Audience contact create failed", legacyBody.slice(0, 1000));
    return { ok: false, detail: "Resend could not store this address." };
  }

  const modern = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
      segments: [{ id: audienceId }],
    }),
  });
  if (modern.ok || modern.status === 409) return { ok: true };
  const modernBody = await modern.text();
  await logError("resend", "Contact create failed", modernBody.slice(0, 1000));
  return { ok: false, detail: "Resend could not store this address." };
}

export async function sendOwnerEmail(subject: string, text: string): Promise<ResendResult> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.OWNER_EMAIL;
  if (!key || !to) {
    return { ok: false, skipped: true, detail: "Owner email is not configured." };
  }
  const from = process.env.RESEND_FROM_EMAIL || "ClaimDeadline <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (response.ok) return { ok: true };
  const body = await response.text();
  await logError("resend", "Owner email failed", body.slice(0, 1000));
  return { ok: false, detail: "The message was saved, but the email was not sent." };
}
