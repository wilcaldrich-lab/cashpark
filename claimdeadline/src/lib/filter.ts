import { isOpen } from "./dates";
import type { Settlement, SettlementFilters } from "./types";

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): SettlementFilters {
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";
  return {
    q: one(sp.q).trim().slice(0, 200),
    noProof: one(sp.noproof) === "1",
    state: one(sp.state).trim().toUpperCase().slice(0, 32),
    category: one(sp.category).trim().toLowerCase().slice(0, 40),
  };
}

export function filtersAreActive(filters: SettlementFilters): boolean {
  return Boolean(
    filters.q || filters.noProof || filters.state || filters.category,
  );
}

export function filterSettlements(
  settlements: Settlement[],
  filters: SettlementFilters,
  today?: string,
): Settlement[] {
  const q = filters.q.toLowerCase();
  return settlements
    .filter((settlement) => isOpen(settlement.deadline, today))
    .filter((settlement) => {
      if (filters.noProof && settlement.proofRequired !== false) return false;
      if (filters.category && settlement.category !== filters.category) {
        return false;
      }
      if (filters.state === "NATIONWIDE") {
        if (!settlement.states.includes("nationwide")) return false;
      } else if (filters.state) {
        const matchesState = settlement.states.includes(filters.state);
        const nationwide = settlement.states.includes("nationwide");
        if (!matchesState && !nationwide) return false;
      }
      if (!q) return true;
      const haystack = [
        settlement.name,
        settlement.eligibility,
        settlement.caseName ?? "",
        settlement.category,
        settlement.payoutEstimate ?? "",
        settlement.fundAmount ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => {
      const byDate = a.deadline.localeCompare(b.deadline);
      return byDate === 0 ? a.name.localeCompare(b.name) : byDate;
    });
}

export function categoryLabel(id: string): string {
  const labels: Record<string, string> = {
    "data-breach": "Data breach",
    privacy: "Privacy",
    consumer: "Consumer",
    finance: "Finance",
    auto: "Auto",
    health: "Health",
  };
  return labels[id] ?? id;
}

export function coverageLabel(states: string[]): string {
  if (states.includes("nationwide")) return "Nationwide";
  if (states.length === 0) return "See notice";
  return states.join(", ");
}

export function proofLabel(proofRequired: boolean | null): string {
  if (proofRequired === true) return "Proof required";
  if (proofRequired === false) return "No proof needed";
  return "Proof not stated";
}
