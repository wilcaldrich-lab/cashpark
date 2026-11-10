import type { Metadata } from "next";
import { FreeNote } from "@/components/free-note";
import { SubmitForm } from "@/components/submit-form";
import { recordPageview } from "@/lib/settlements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Submit a settlement",
  description: "Send an official class action settlement URL and claim deadline for review.",
};

export default async function SubmitPage() {
  await recordPageview("/submit");
  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="kicker">Reader tip</p>
        <h1 className="wordmark mt-2 text-4xl">Submit a settlement</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--ink-soft)]">
          Send the official administrator URL, the claim deadline, and any notes. Submissions stay in a review queue.
        </p>
      </header>
      <FreeNote />
      <SubmitForm />
    </div>
  );
}
