/** The service row is read per request; this holds its first sections. */
export default function Loading() {
  return (
    <div className="min-h-dvh bg-canvas" aria-busy="true">
      <span className="sr-only">Loading this service…</span>
      <div className="mx-auto w-full max-w-focus px-4 py-10 sm:px-6 sm:py-14">
        <div className="h-4 w-36 animate-pulse rounded-full bg-line" />
        <div className="mt-6 h-10 w-2/3 animate-pulse rounded-xl bg-line" />
        <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded-lg bg-line/70" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="h-40 animate-pulse rounded-card border border-line bg-surface" />
          <div className="h-40 animate-pulse rounded-card border border-line bg-surface" />
        </div>
      </div>
    </div>
  );
}
