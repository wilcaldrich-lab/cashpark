import type { Metadata } from "next";
import { SponsorInquiry } from "@/components/sponsor-form";
import { recordPageview } from "@/lib/settlements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sponsor a week",
  description: "Sponsor ClaimDeadline for $49 a week. Live subscriber and pageview counts, no checkout.",
};

export default async function SponsorPage() {
  await recordPageview("/sponsor");
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="kicker">$49 / week</p>
        <h1 className="wordmark mt-2 text-4xl sm:text-5xl">Sponsor the docket</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed">
          One sponsor line on the site and in the Monday deadline alert. No checkout on this page — write and we’ll reply.
        </p>
      </header>
      <SponsorInquiry />
    </div>
  );
}
