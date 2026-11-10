"use client";

import { useSyncExternalStore } from "react";
import type { SponsorWeek } from "@/lib/types";

const CHANGE = "claimdeadline-sponsor-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE, onStoreChange);
  return () => window.removeEventListener(CHANGE, onStoreChange);
}

export function SponsorBar({ sponsor }: { sponsor: SponsorWeek }) {
  const storageKey = `claimdeadline-sponsor-${sponsor.slug}`;
  const dismissed = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey) === "1",
    () => false,
  );

  if (dismissed) return null;

  return (
    <div className="sponsor-bar">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <a href={`/go/${sponsor.slug}`} className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">
          <span className="opacity-70">Sponsored · </span>
          {sponsor.sponsorName}
          {sponsor.tagline ? ` — ${sponsor.tagline}` : ""}
        </a>
        <button
          type="button"
          className="shrink-0 border border-white/30 px-2 py-0.5"
          aria-label="Close sponsor bar"
          onClick={() => {
            window.localStorage.setItem(storageKey, "1");
            window.dispatchEvent(new Event(CHANGE));
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
