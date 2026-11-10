import Link from "next/link";
import { SponsorBar } from "./sponsor-bar";
import { currentSponsor } from "@/lib/sponsors";
import { FREE_FILING_NOTE, SITE_NAME } from "@/lib/site";
import { formatDeadline, todayInNewYork } from "@/lib/dates";

export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const sponsor = await currentSponsor();
  const today = formatDeadline(todayInNewYork());

  return (
    <>
      {sponsor ? <SponsorBar sponsor={sponsor} /> : null}
      <header className="masthead">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:py-6">
          <div className="flex items-end justify-between gap-4">
            <Link href="/" className="wordmark text-[2.6rem] sm:text-6xl">
              {SITE_NAME}
            </Link>
            <p className="kicker hidden text-right sm:block">
              Docket
              <br />
              {today}
            </p>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--ink)] pt-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-xl text-sm leading-snug text-[var(--ink-soft)]">
              Open US class actions, soonest claim deadline first. This site does not file claims and is not a settlement administrator.
            </p>
            <nav className="kicker flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/">Open</Link>
              <Link href="/new">New</Link>
              <Link href="/submit">Submit</Link>
              <Link href="/sponsor">Sponsor</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="mt-8 border-t border-[var(--ink)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-[var(--ink-soft)] sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-md">{FREE_FILING_NOTE}</p>
          <p className="kicker">Not legal advice · Monday deadline alert</p>
        </div>
      </footer>
    </>
  );
}
