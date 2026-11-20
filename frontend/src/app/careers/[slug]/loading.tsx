/**
 * Shown while a profile is read from the catalogue. The page is request-time
 * data, so this replaces a blank main area rather than a page that could have
 * been painted sooner. `animate-pulse` is neutralised by the reduced-motion
 * rules in `globals.css`, including the in-app accessibility switch.
 */
export default function Loading() {
  return (
    <div className="min-h-dvh bg-canvas" aria-busy="true">
      <span className="sr-only">Loading this career profile…</span>
      <div className="mx-auto w-full max-w-page px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10">
        <div className="h-4 w-40 animate-pulse rounded-full bg-line" />
        <div className="mt-6 h-10 w-2/3 animate-pulse rounded-xl bg-line" />
        <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-lg bg-line/70" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="h-44 animate-pulse rounded-card border border-line bg-surface" />
          <div className="h-44 animate-pulse rounded-card border border-line bg-surface" />
        </div>
      </div>
    </div>
  );
}
