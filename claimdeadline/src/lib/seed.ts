import seedFile from "../../data/settlements.json";
import type { Settlement } from "./types";

type SeedFile = {
  researchedOn: string;
  settlements: Settlement[];
};

const file = seedFile as SeedFile;

export function seedSettlements(): Settlement[] {
  return file.settlements.map((settlement) => ({
    ...settlement,
    payoutEstimate: settlement.payoutEstimate ?? null,
    deadlineNote: settlement.deadlineNote ?? null,
    proofRequired:
      settlement.proofRequired === undefined ? null : settlement.proofRequired,
    caseName: settlement.caseName ?? null,
    fundAmount: settlement.fundAmount ?? null,
    states: settlement.states ?? [],
  }));
}

export function seedResearchedOn(): string {
  return file.researchedOn;
}
