"use client";

import { useEffect, useState } from "react";

type Stats = { subscribers: number; monthlyPageviews: number; database: boolean };

export function SponsorInquiry() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/sponsor")
      .then((response) => response.json())
      .then((body: Stats) => setStats(body))
      .catch(() => setStats({ subscribers: 0, monthlyPageviews: 0, database: false }));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("loading");
    try {
      const response = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as { error?: string; emailed?: boolean };
      if (!response.ok) {
        setStatus("error");
        setMessage(body.error ?? "Could not send that note.");
        return;
      }
      setStatus("done");
      setMessage(
        body.emailed
          ? "Saved, and a note is on its way to the owner."
          : "Saved. Email delivery is not configured yet, so the owner will read it from the database.",
      );
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Could not send that note.");
    }
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="docket p-4">
          <p className="kicker">Subscribers</p>
          <p className="days mt-2 text-4xl">{stats ? stats.subscribers.toLocaleString("en-US") : "—"}</p>
        </div>
        <div className="docket p-4">
          <p className="kicker">Pageviews this month</p>
          <p className="days mt-2 text-4xl">
            {stats ? stats.monthlyPageviews.toLocaleString("en-US") : "—"}
          </p>
        </div>
      </section>
      {stats && !stats.database ? (
        <p className="text-sm text-[var(--ink-soft)]">
          Live counts appear after Postgres is connected. Both numbers are zero until then.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="docket grid gap-3 p-4">
        <p className="kicker">Get in touch</p>
        <label>
          <span className="kicker">Name</span>
          <input className="field mt-1" name="name" required maxLength={200} />
        </label>
        <label>
          <span className="kicker">Email</span>
          <input className="field mt-1" name="email" type="email" required maxLength={320} />
        </label>
        <label>
          <span className="kicker">Organization</span>
          <input className="field mt-1" name="organization" maxLength={200} />
        </label>
        <label>
          <span className="kicker">Message</span>
          <textarea className="field mt-1 min-h-28" name="message" required maxLength={5000} />
        </label>
        <button className="btn" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Sending" : "Send"}
        </button>
        {message ? (
          <p className={`text-sm ${status === "error" ? "stamp" : ""}`} role="status">
            {message}
          </p>
        ) : null}
      </form>
    </>
  );
}
