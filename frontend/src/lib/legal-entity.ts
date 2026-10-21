/**
 * Who is answerable for this deployment, in one place.
 *
 * The legal pages used to spell `[COMPANY_NAME]`, `[ADDRESS]`, `[CITY]` and
 * `[EMAIL]` at four different files, which meant four places to edit at launch
 * and four chances to leave one behind. Every one of them now reads from here,
 * and here reads from the build environment.
 *
 * Two things are deliberately held apart. A *label* on a page ("Grievance
 * officer", "Postal address") is fixed prose and lives in the page. A *value* is
 * the operator's, and a value can only come from the operator. The defaults
 * below are sample values: they let the policy read as a finished document on a
 * demonstration build, and `IS_SAMPLE` is what tells a reader — and the person
 * deploying this — that they are still samples. Fill the five variables named
 * there and the note disappears by itself; nothing else has to be rewritten.
 *
 * These are `NEXT_PUBLIC_` names on purpose. Everything here is printed on a
 * page any visitor can read, so nothing here can be a secret. A phone number is
 * the one field the pages omit rather than invent: no sample is shown for it,
 * because "call us" is a promise somebody has to staff, unlike an address.
 */

const GIVEN = {
  company: process.env.NEXT_PUBLIC_LEGAL_COMPANY,
  officer: process.env.NEXT_PUBLIC_LEGAL_OFFICER,
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL,
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS,
  city: process.env.NEXT_PUBLIC_LEGAL_CITY,
  phone: process.env.NEXT_PUBLIC_LEGAL_PHONE,
  replyDays: process.env.NEXT_PUBLIC_LEGAL_REPLY_DAYS,
};

/** A value the operator typed, or the sample — a leftover `[TOKEN]` counts as nobody typing anything. */
function taken(given: string | undefined, sample: string): string {
  const trimmed = given?.trim();
  if (!trimmed || trimmed.startsWith("[")) return sample;
  return trimmed;
}

export const COMPANY = taken(GIVEN.company, "CareerGuide");

/**
 * A person's name is the one field this file will not sample. Inventing a
 * grievance officer would put a name on a child's privacy policy that belongs to
 * nobody, so the row is simply absent until the operator names a human, and the
 * copy on these pages points at whoever operates the deployment instead.
 */
export const OFFICER = GIVEN.officer?.trim().startsWith("[")
  ? ""
  : (GIVEN.officer?.trim() ?? "");

export const GRIEVANCE_EMAIL = taken(GIVEN.email, "grievance@careerguide.com");

/** Where paper goes. Not a registered-office claim — see `IS_SAMPLE`. */
export const POSTAL_ADDRESS = taken(GIVEN.address, "123 Tech Park, New Delhi, India");

/** Names the courts the terms point at, and appears in the address itself. */
export const CITY = taken(GIVEN.city, "New Delhi");

/** Empty unless the operator sets it; the pages then say email is the only way in. */
export const PHONE = GIVEN.phone?.trim().startsWith("[") ? "" : (GIVEN.phone?.trim() ?? "");

/** The window a real operator answers within. */
export const REPLY_DAYS = taken(GIVEN.replyDays, "30 days");

/**
 * True while any identity field is still the sample. Every page that prints one
 * of the values above prints this note beside it.
 */
export const IS_SAMPLE = [
  GIVEN.company,
  GIVEN.officer,
  GIVEN.email,
  GIVEN.address,
  GIVEN.city,
].some((given) => taken(given, "") === "");

/** The rows under "Grievance officer" on the privacy and contact pages. */
export function OFFICER_FIELDS(): { label: string; value: string }[] {
  const rows = [{ label: "Company", value: COMPANY }];
  if (OFFICER) rows.push({ label: "Officer’s name", value: OFFICER });
  rows.push({ label: "Email", value: GRIEVANCE_EMAIL });
  if (PHONE) rows.push({ label: "Phone", value: PHONE });
  rows.push(
    { label: "Postal address", value: POSTAL_ADDRESS },
    { label: "Response time", value: REPLY_DAYS },
  );
  return rows;
}

/** The rows under "Business contact" on the contact page. */
export function BUSINESS_FIELDS(): { label: string; value: string }[] {
  const rows = [
    { label: "Company", value: COMPANY },
    { label: "Registered address", value: POSTAL_ADDRESS },
  ];
  if (PHONE) rows.push({ label: "Phone", value: PHONE });
  return rows;
}

/** One line, same wording everywhere, so one edit changes four pages. */
export const SAMPLE_NOTE =
  "These details are sample values on a demonstration build. Nobody monitors this inbox yet, and no company has been registered behind them, so treat an answer as unlikely rather than slow. Whoever runs a real deployment replaces them by setting NEXT_PUBLIC_LEGAL_COMPANY, _OFFICER, _EMAIL, _ADDRESS and _CITY at build time, and this note then disappears.";
