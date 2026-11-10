import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { render } from "@react-email/render";
import WeeklyEmail from "../emails/weekly";
import { daysUntil, formatDeadline, todayInNewYork } from "../src/lib/dates";
import { filterSettlements } from "../src/lib/filter";
import type { Settlement } from "../src/lib/types";

const root = path.resolve(import.meta.dirname, "..");
const file = JSON.parse(readFileSync(path.join(root, "data/settlements.json"), "utf8")) as {
  settlements: Settlement[];
};
const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const open = filterSettlements(file.settlements, {
  q: "",
  noProof: false,
  state: "",
  category: "",
});
const picks = open.slice(0, 5).map((settlement) => {
  const days = daysUntil(settlement.deadline, todayInNewYork());
  return {
    name: settlement.name,
    href: `${site}/settlement/${settlement.slug}`,
    deadlineLabel: `${formatDeadline(settlement.deadline)} (${days}d)`,
    payout: settlement.payoutEstimate ?? "Amount not published",
  };
});

async function main() {
  const html = await render(
    <WeeklyEmail
      picks={picks}
      siteUrl={site}
      sponsorName={process.env.WEEKLY_SPONSOR_NAME || null}
      sponsorHref={process.env.WEEKLY_SPONSOR_URL || null}
    />,
  );
  const outDir = path.join(root, "emails");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "weekly.preview.html");
  writeFileSync(outFile, html);
  console.log(`Rendered ${picks.length} picks to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
