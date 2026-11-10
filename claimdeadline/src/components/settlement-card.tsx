import Link from "next/link";
import { daysLeftLabel, daysUntil, formatDeadline } from "@/lib/dates";
import { categoryLabel, coverageLabel, proofLabel } from "@/lib/filter";
import type { Settlement } from "@/lib/types";

export function SettlementCard({ settlement }: { settlement: Settlement }) {
  const days = daysUntil(settlement.deadline);
  const urgent = days <= 14;

  return (
    <Link
      href={`/settlement/${settlement.slug}`}
      className="docket grid grid-cols-[5.6rem_1fr] gap-3 p-3 transition sm:grid-cols-[7rem_1fr] sm:p-4"
    >
      <div className={urgent ? "stamp" : ""}>
        <p className="days text-3xl leading-none sm:text-4xl">{days < 0 ? "—" : days}</p>
        <p className="kicker mt-1">{daysLeftLabel(days)}</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl leading-tight tracking-tight sm:text-2xl">
            {settlement.name}
          </h2>
        </div>
        <p className="mt-1 text-[15px]">
          {settlement.payoutEstimate ?? "Payout estimate not published"}
        </p>
        <p className="kicker mt-2 text-[var(--ink-soft)]">
          Closes {formatDeadline(settlement.deadline)}
          <span className="mx-2">·</span>
          {proofLabel(settlement.proofRequired)}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-snug text-[var(--ink-soft)]">
          {settlement.eligibility}
        </p>
        <p className="kicker mt-2">
          {coverageLabel(settlement.states)}
          <span className="mx-2">·</span>
          {categoryLabel(settlement.category)}
        </p>
      </div>
    </Link>
  );
}
