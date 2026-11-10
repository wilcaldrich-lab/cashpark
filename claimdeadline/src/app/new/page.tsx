import type { Metadata } from "next";
import { SettlementCard } from "@/components/settlement-card";
import { shiftDays, todayInNewYork } from "@/lib/dates";
import { listSettlements, recordPageview } from "@/lib/settlements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New settlements",
  description: "US class action settlements added to ClaimDeadline in the last 7 days.",
};

export default async function NewPage() {
  const { settlements } = await listSettlements();
  const cutoff = shiftDays(todayInNewYork(), -7);
  const recent = settlements.filter((settlement) => settlement.publishedAt >= cutoff);
  await recordPageview("/new");

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="kicker">Last 7 days</p>
        <h1 className="wordmark mt-2 text-4xl">Just added</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--ink-soft)]">
          Settlements published to this tracker since {cutoff}. Deadlines are still sorted soonest first.
        </p>
      </header>
      {recent.length === 0 ? (
        <p className="docket p-4 text-sm">Nothing new in the last 7 days.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {recent.map((settlement) => (
            <li key={settlement.slug}>
              <SettlementCard settlement={settlement} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
