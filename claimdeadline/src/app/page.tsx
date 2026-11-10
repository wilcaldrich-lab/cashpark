import type { Metadata } from "next";
import { FilterBar } from "@/components/filter-bar";
import { FreeNote } from "@/components/free-note";
import { SettlementCard } from "@/components/settlement-card";
import { SignupForm } from "@/components/signup-form";
import { filterSettlements, filtersAreActive, parseFilters } from "@/lib/filter";
import { listSettlements, logZeroResult, recordPageview } from "@/lib/settlements";
import { SITE_DESCRIPTION } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: PageProps<"/">): Promise<Metadata> {
  const filters = parseFilters(await searchParams);
  if (!filtersAreActive(filters)) {
    return {
      title: "Open class action settlements by claim deadline",
      description: SITE_DESCRIPTION,
    };
  }
  const label = filters.q ? `Search: ${filters.q}` : "Filtered settlements";
  return {
    title: label,
    description: SITE_DESCRIPTION,
    robots: { index: false, follow: true },
  };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const filters = parseFilters(await searchParams);
  const { settlements, source } = await listSettlements();
  const open = filterSettlements(settlements, {
    q: "",
    noProof: false,
    state: "",
    category: "",
  });
  const visible = filterSettlements(settlements, filters);
  await recordPageview("/");
  if (visible.length === 0 && filtersAreActive(filters)) {
    await logZeroResult(filters);
  }

  return (
    <div className="flex flex-col gap-5">
      <FreeNote />
      <FilterBar filters={filters} count={visible.length} total={open.length} />
      {visible.length === 0 ? (
        <p className="docket p-4 text-sm">
          No open settlements match. Try a broader search, or{" "}
          <a className="underline" href="/submit">
            send one we missed
          </a>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((settlement) => (
            <li key={settlement.slug}>
              <SettlementCard settlement={settlement} />
            </li>
          ))}
        </ul>
      )}
      <SignupForm source="home" />
      <p className="kicker text-[var(--ink-soft)]">
        List source: {source === "database" ? "database" : "seed file"} · Amounts can change after fees and claims
      </p>
    </div>
  );
}
