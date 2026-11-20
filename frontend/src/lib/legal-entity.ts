/**
 * Who is answerable for this deployment, in one place.
 *
 * CareerGuide AI is an individually developed student project, not a registered
 * company. This file therefore holds no company name, no registered address, no
 * personal name, no phone number and no registration number: inventing any of
 * them would put a claim on a child's privacy policy that nobody stands behind.
 *
 * The one detail a deployment can supply is a contact email. The name is
 * `NEXT_PUBLIC_` on purpose — an address printed on a public page cannot be a
 * secret. When none is configured, every page that would print one says instead
 * that no dedicated support email is currently available.
 */

const CONFIGURED_EMAIL = (process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? "").trim();

/** The operator's contact address, or "" when this build has none. A leftover
 * `[TOKEN]` counts as nobody having configured anything. */
export const CONTACT_EMAIL =
  CONFIGURED_EMAIL && !CONFIGURED_EMAIL.startsWith("[") ? CONFIGURED_EMAIL : "";

/** The sentence every page uses in place of an address when `CONTACT_EMAIL` is empty. */
export const NO_EMAIL_SENTENCE = "No dedicated support email is currently available.";
