/** Rupees, formatted from the paise the server sends.

Every amount in this app is an integer number of paise, on both sides of the wire, and
this file is the only place that turns one into a string a person reads. The backend's
`plans.rupees` does the same job for the printed report and for the checkout description;
keeping the two rules in step matters because a page that shows ₹299 and an order that
charges ₹299.00 are the same promise made twice.
 */

/** `null` means "no price yet" — the school plan — and is printed as a dash, never as ₹0. */
export function rupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  const whole = Math.floor(paise / 100);
  const remainder = paise % 100;
  // Indian digit grouping, because "₹2,49,900" is what a reader here expects.
  const grouped = whole.toLocaleString("en-IN");
  return remainder ? `₹${grouped}.${String(remainder).padStart(2, "0")}` : `₹${grouped}`;
}

/**
 * What a paid period works out to per month, always rounded *down*. Rounding up would
 * advertise a saving the invoice does not deliver: ₹2,499 over twelve months is
 * ₹208.25, and the honest word for that is about ₹208.
 *
 * The amount only. The sentence around it belongs to the caller, because "about" is
 * UI copy and UI copy is what the Hindi dictionary is allowed to translate.
 */
export function perMonthAmount(paise: number | null | undefined, months: number): string {
  if (paise === null || paise === undefined || months < 1) return "";
  return rupees(Math.floor(paise / months));
}

/** A date as a family reads it on a bill, or "" when there is nothing to show yet. */
export function billDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return "";
  return moment.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
