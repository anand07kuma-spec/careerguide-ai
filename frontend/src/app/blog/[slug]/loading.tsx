/** The guide's markdown is read from disk per request; this holds its shape. */
export default function Loading() {
  return (
    <div className="min-h-dvh bg-canvas" aria-busy="true">
      <span className="sr-only">Loading this guide…</span>
      <div className="mx-auto w-full max-w-focus px-4 py-10 sm:px-6 sm:py-14">
        <div className="h-4 w-32 animate-pulse rounded-full bg-line" />
        <div className="mt-6 h-10 w-3/4 animate-pulse rounded-xl bg-line" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded-lg bg-line/70" />
        <div className="mt-10 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-line/70" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-line/70" />
          <div className="h-4 w-10/12 animate-pulse rounded bg-line/70" />
          <div className="h-4 w-9/12 animate-pulse rounded bg-line/70" />
        </div>
      </div>
    </div>
  );
}
