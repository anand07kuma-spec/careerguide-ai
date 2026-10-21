/**
 * Shared vocabulary for the two portals.
 *
 * The colour list is a mirror of `AccentColor` in `backend/app/schemas.py`, and it has to
 * stay one: the server refuses a hex that is not on that list, so a picker that offered a
 * eighth colour would be a button that fails. The words for each role are here rather than
 * in each screen because a roster, an invitation and a client list all have to call the
 * same person the same thing.
 */

import type { MemberRole, InviteInput, OrgKind } from "./types";

/** The platform's own tokens, in the order the picker shows them. */
export const ACCENTS: { value: string; name: string }[] = [
  { value: "#2563eb", name: "Blue" },
  { value: "#0e7490", name: "Teal" },
  { value: "#047857", name: "Green" },
  { value: "#4338ca", name: "Indigo" },
  { value: "#7e22ce", name: "Purple" },
  { value: "#b45309", name: "Amber" },
  { value: "#0f172a", name: "Ink" },
];

export const ROLE_WORDS: Record<MemberRole, string> = {
  student: "Student",
  parent: "Parent",
  counsellor: "Counsellor",
  school_admin: "Administrator",
};

export const KIND_WORDS: Record<OrgKind, string> = {
  school: "School portal",
  counsellor: "Counsellor practice",
};

/** The roles a portal may hold a place for. A child account is never handed a staff role. */
export const INVITABLE_ROLES: MemberRole[] = ["student", "parent", "counsellor", "school_admin"];

export const STAFF_ROLES: MemberRole[] = ["counsellor", "school_admin"];

/**
 * Whether this member runs the portal rather than works inside it — the frontend mirror of
 * `can_manage` in `backend/app/security.py`, and the screen uses it to decide which tabs to
 * draw, not whom to let in. A counsellor employed by a school is not the school's
 * administrator, and the server refuses them the branding and the roster exactly as this
 * function does.
 */
export function canManage(kind: OrgKind, role: MemberRole): boolean {
  if (role === "school_admin") return true;
  return kind === "counsellor" && role === "counsellor";
}

/** A class list pasted from a spreadsheet: one row per line, `email` or `email, label`. */
export const BULK_MAX_ROWS = 50;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseBulkList(text: string, role: MemberRole): InviteInput[] {
  const out: InviteInput[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/[,;\t]/).map((part) => part.trim());
    const email = (parts[0] ?? "").toLowerCase();
    if (!EMAIL.test(email)) continue;
    const label = parts.slice(1).join(" ").trim();
    out.push({ email, org_role: role, display_label: label ? label.slice(0, 80) : null });
  }
  return out.slice(0, BULK_MAX_ROWS);
}

/** How many pasted lines will not be sent, so the screen can say it before a click. */
export function rejectedRows(text: string): number {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length - parseBulkList(text, "student").length;
}

/**
 * The domain a portal's address sits under, or "" when this deployment has not said.
 *
 * It is not guessed from the site origin: `careerguide.localhost` and
 * `careerguide-ai.vercel.app` are not spelled alike, and a screen that built
 * `green-school.careerguide-ai.vercel.app` out of the second would be printing an address
 * that resolves nowhere. Nothing is shown until somebody configures the wildcard.
 */
export function tenantBaseDomain(): string {
  return (process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN ?? "").trim().toLowerCase();
}

/** The address an invitation letter carries, or null when this deployment has no subdomains. */
export function portalHost(slug: string): string | null {
  const base = tenantBaseDomain();
  return base ? `${slug}.${base}` : null;
}

/**
 * Which portal this browser arrived at, read from the hostname it used.
 *
 * Presentation only, and it has to stay that way: this value chooses a logo and a
 * heading, never a row. The backend re-checks the host of every tenant request against
 * the slug in the path and answers 404 on a mismatch, so a DNS record pointing a school's
 * subdomain at another school's data would show a name over the wrong numbers, not the
 * wrong numbers over nothing.
 */
export function subdomainFromHost(hostname: string): string | null {
  const base = tenantBaseDomain();
  if (!base) return null;
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  if (host === base || !host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, -(base.length + 1));
  if (!label.includes(".") && /^[a-z0-9](?:-?[a-z0-9]){2,39}$/.test(label)) return label;
  return null;
}
