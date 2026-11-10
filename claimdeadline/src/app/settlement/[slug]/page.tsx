import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FreeNote } from "@/components/free-note";
import { SignupForm } from "@/components/signup-form";
import { daysLeftLabel, daysUntil, formatDeadline } from "@/lib/dates";
import { categoryLabel, coverageLabel, proofLabel } from "@/lib/filter";
import { getSettlement, recordPageview } from "@/lib/settlements";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/settlement/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const settlement = await getSettlement(slug);
  if (!settlement) return { title: "Settlement not found" };
  const description = `${settlement.eligibility} Claim deadline ${formatDeadline(settlement.deadline)}.`;
  return {
    title: settlement.name,
    description,
    openGraph: { title: settlement.name, description },
  };
}

export default async function SettlementPage({
  params,
}: PageProps<"/settlement/[slug]">) {
  const { slug } = await params;
  const settlement = await getSettlement(slug);
  if (!settlement) notFound();
  await recordPageview(`/settlement/${slug}`);
  const days = daysUntil(settlement.deadline);

  return (
    <article className="flex flex-col gap-5">
      <p className="kicker">
        <Link href="/" className="underline">
          Open claims
        </Link>
      </p>
      <header>
        <p className={`days text-5xl ${days <= 14 ? "stamp" : ""}`}>{daysLeftLabel(days)}</p>
        <h1 className="wordmark mt-2 text-4xl sm:text-5xl">{settlement.name}</h1>
        <p className="mt-3 text-lg">
          {settlement.payoutEstimate ?? "No per-person payout estimate has been published."}
        </p>
      </header>
      <FreeNote />
      <dl className="docket grid gap-4 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="kicker">Claim deadline</dt>
          <dd className="mt-1 text-base">{formatDeadline(settlement.deadline)}</dd>
          {settlement.deadlineNote ? <dd className="mt-1 text-[var(--ink-soft)]">{settlement.deadlineNote}</dd> : null}
        </div>
        <div>
          <dt className="kicker">Proof</dt>
          <dd className="mt-1 text-base">{proofLabel(settlement.proofRequired)}</dd>
        </div>
        <div>
          <dt className="kicker">Coverage</dt>
          <dd className="mt-1 text-base">{coverageLabel(settlement.states)}</dd>
        </div>
        <div>
          <dt className="kicker">Category</dt>
          <dd className="mt-1 text-base">{categoryLabel(settlement.category)}</dd>
        </div>
        {settlement.fundAmount ? (
          <div>
            <dt className="kicker">Settlement fund</dt>
            <dd className="mt-1 text-base">{settlement.fundAmount}</dd>
          </div>
        ) : null}
        {settlement.caseName ? (
          <div className="sm:col-span-2">
            <dt className="kicker">Case</dt>
            <dd className="mt-1">{settlement.caseName}</dd>
          </div>
        ) : null}
      </dl>
      <section>
        <h2 className="kicker">Eligibility</h2>
        <p className="mt-2 text-base leading-relaxed">{settlement.eligibility}</p>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a className="btn" href={`/go/${settlement.slug}`}>
          Official claim site
        </a>
        <a className="btn btn-ghost" href={settlement.sourceUrl} target="_blank" rel="noreferrer">
          Source
        </a>
      </div>
      <SignupForm source={`settlement:${settlement.slug}`} />
    </article>
  );
}
