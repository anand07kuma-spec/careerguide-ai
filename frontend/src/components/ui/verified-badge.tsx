import { makeT, makeTf, type PublicLang } from "@/lib/public-i18n";
import { cn } from "@/lib/utils";

/**
 * The one place the words 'this was checked' are printed.
 *
 * Two facts decide what this says, and both come from the database: `verifiedAt` is stamped
 * by the code that certified a row — `scripts/verify_data.py` takes the day from its own
 * clock and no request body can supply one — and `sourceUrl` is the page a person named when
 * they stamped it. So there are exactly three honest states, and the third is the common one:
 *
 * * a date and a page → the date, with the page next to it;
 * * a date and no page → the date alone, which is a real record from before the source
 *   column existed and is not the same thing as never having been checked;
 * * no date → nobody has read it, and the card says so in words.
 *
 * The last row is the reason this component exists as its own file rather than as a `Badge`
 * call at each screen. A green tick on a row whose `verified_at` is null would be the app
 * claiming a check that did not happen, and there are five pages that could get it wrong
 * independently. Here there is one branch, it takes `verifiedAt` as its only input, and a
 * null cannot reach the green side of it.
 *
 * Two more things the styling is doing on purpose:
 *
 * * The unchecked state is grey, not red. A warning colour on the page a fifteen-year-old
 *   chooses a career from reads as a fault in the app, when what it reports is an ordinary
 *   step nobody has taken yet.
 * * The word travels with the colour in both states. Nothing here is a dot that has to be
 *   decoded, so the badge still says the same thing in a grey classroom printout, to a
 *   colour-blind reader, and with the stylesheet failing to load.
 */

const dateFmt: Record<PublicLang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }),
  hi: new Intl.DateTimeFormat("hi-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }),
};

/**
 * The stamp arrives naive and in UTC, the way `UTCDateTime` in the backend hands it back.
 * Without an offset a browser reads it in the visitor's own zone, so a check made in the
 * Indian evening prints tomorrow's date on a European laptop.
 */
function checkedOn(iso: string, lang: PublicLang): string | null {
  const stamped = /(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso.replace(" ", "T")}Z`;
  const date = new Date(stamped);
  return Number.isNaN(date.getTime()) ? null : dateFmt[lang].format(date);
}

/** Only an https page is worth a link from a badge that means "this was checked". */
function isPublicPage(url: string): boolean {
  return /^https:\/\//i.test(url.trim());
}

export function VerifiedBadge({
  verifiedAt,
  sourceUrl,
  lang = "en",
  className,
}: {
  /** The day somebody read this row against its official page, or null when nobody has. */
  verifiedAt?: string | null;
  /** The page they named, when the row carries one. */
  sourceUrl?: string | null;
  lang?: PublicLang;
  className?: string;
}) {
  const t = makeT(lang);
  const tf = makeTf(lang);
  const day = verifiedAt ? checkedOn(verifiedAt, lang) : null;

  if (!day) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium leading-normal text-slate-700",
          className,
        )}
      >
        {t("Not checked yet — confirm on the official site")}
      </span>
    );
  }

  const page = sourceUrl && isPublicPage(sourceUrl) ? sourceUrl.trim() : null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-full bg-success-mist px-2.5 py-1 text-xs font-medium leading-normal text-success-dark",
        className,
      )}
    >
      {/* The tick is decoration beside a sentence that already says it; `aria-hidden` is what
          keeps a screen reader from hearing the claim twice. */}
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-current">
        <path d="M8 0a8 8 0 1 0 8 8A8.01 8.01 0 0 0 8 0Zm3.9 6.3-4.3 4.3a1 1 0 0 1-1.4 0L4.1 7.9a1 1 0 1 1 1.4-1.4l1.4 1.4 3.6-3.6a1 1 0 0 1 1.4 1.4Z" />
      </svg>
      <span>{tf("Checked {date}", { date: day })}</span>
      {page ? (
        <>
          <span aria-hidden>·</span>
          {/* A link, not a button: this is a reference to a page, and it has to survive the
              badge's own script never loading on the public page it sits on. */}
          <a
            href={page}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:no-underline break-all"
          >
            {t("source")}
          </a>
        </>
      ) : null}
    </span>
  );
}
