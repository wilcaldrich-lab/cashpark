import Link from "next/link";

export default function NotFound() {
  return (
    <div className="docket p-5">
      <p className="kicker">404</p>
      <h1 className="wordmark mt-2 text-4xl">Not on the docket</h1>
      <p className="mt-3 text-sm">That settlement is not in the open list.</p>
      <Link className="btn mt-4" href="/">
        Back to open claims
      </Link>
    </div>
  );
}
