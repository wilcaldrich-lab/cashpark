"use client";

import { useState } from "react";

export function SignupForm({ source }: { source: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const body = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setStatus("error");
        setMessage(body.error ?? "Could not save that email.");
        return;
      }
      setStatus("done");
      setMessage("You’re on the Monday deadline alert.");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Could not save that email.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="docket p-4">
      <p className="kicker">Monday deadline alert</p>
      <p className="mt-2 text-sm leading-snug">
        Five open claims, soonest deadlines first. No account. Unsubscribe any time by replying to the email.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`email-${source}`}>
          Email
        </label>
        <input
          id={`email-${source}`}
          className="field"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
        />
        <button className="btn" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Saving" : "Get the alert"}
        </button>
      </div>
      {message ? (
        <p className={`mt-2 text-sm ${status === "error" ? "stamp" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
