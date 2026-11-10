"use client";

import { useState } from "react";

export function SubmitForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("loading");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(body.error ?? "Could not save that submission.");
        return;
      }
      setStatus("done");
      setMessage("Saved for review. It will not appear on the list until it is checked.");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Could not save that submission.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="docket grid gap-3 p-4">
      <label>
        <span className="kicker">Settlement name</span>
        <input className="field mt-1" name="name" required maxLength={200} />
      </label>
      <label>
        <span className="kicker">Official URL</span>
        <input className="field mt-1" name="officialUrl" type="url" required placeholder="https://" />
      </label>
      <label>
        <span className="kicker">Claim deadline</span>
        <input className="field mt-1" name="deadline" type="date" />
      </label>
      <label>
        <span className="kicker">Notes</span>
        <textarea className="field mt-1 min-h-28" name="notes" maxLength={5000} />
      </label>
      <button className="btn" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Saving" : "Submit for review"}
      </button>
      {message ? (
        <p className={`text-sm ${status === "error" ? "stamp" : ""}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
