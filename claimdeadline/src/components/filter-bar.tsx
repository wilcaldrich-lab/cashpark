import Link from "next/link";
import { CATEGORIES, US_STATES, type SettlementFilters } from "@/lib/types";

export function FilterBar({
  filters,
  count,
  total,
}: {
  filters: SettlementFilters;
  count: number;
  total: number;
}) {
  return (
    <form action="/" className="docket mb-5 grid gap-3 p-3 sm:p-4">
      <label className="block">
        <span className="kicker">Search</span>
        <input
          className="field mt-1"
          name="q"
          defaultValue={filters.q}
          placeholder="Name, company, or keyword"
          aria-label="Search settlements"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="kicker">State</span>
          <select className="field mt-1" name="state" defaultValue={filters.state} aria-label="State">
            <option value="">Any state, including nationwide</option>
            <option value="NATIONWIDE">Nationwide only</option>
            {US_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="kicker">Category</span>
          <select
            className="field mt-1"
            name="category"
            defaultValue={filters.category}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="noproof" value="1" defaultChecked={filters.noProof} />
        No proof needed
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" type="submit">
          Apply
        </button>
        <Link className="btn btn-ghost" href="/">
          Reset
        </Link>
        <p className="kicker text-[var(--ink-soft)]">
          {count} of {total} open
        </p>
      </div>
    </form>
  );
}
