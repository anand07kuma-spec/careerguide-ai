import { CareerNotFound, PublicSiteHeader } from "@/components/careers/public-careers-shell";

/**
 * The missing-profile screen for `/careers/<slug>`.
 *
 * It sits in this segment so the page can call `notFound()` and let Next answer
 * with a real 404 status, while the reader still gets career-specific words.
 * A not-found boundary is not handed the page's params, so the sentence does
 * not echo the address — the reader can see it in the browser bar.
 */
export default function CareerNotFoundPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/careers" />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-focus px-4 py-10 sm:px-6">
        <CareerNotFound />
      </main>
    </div>
  );
}
