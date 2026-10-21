/**
 * Clerk is an optional upgrade, and this file is the only place that decides it.
 *
 * The account a student actually uses is the one this browser made for itself — the
 * device id kept in `localStorage`, and the session the server writes back as an
 * `httpOnly` cookie that no page code can read. An email sign-in is something a family
 * can *add* so the same work opens on a new phone. It never becomes the only door: no
 * screen, and no middleware, may require it. So every Clerk surface in this app asks
 * `clerkEnabled()` first and renders an honest "not switched on here" state when the
 * answer is no, instead of a widget that cannot work.
 *
 * The key here is the public one. The secret key lives on the server, in
 * `backend/.env`, and no code in this directory can read it.
 */

export function clerkPublishableKey(): string {
  return (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
}

export function clerkEnabled(): boolean {
  // A value that does not look like a key is treated as no key at all. Half-loading
  // Clerk's widget and showing a family an error is worse than saying plainly that
  // this deployment has not switched email sign-in on.
  return clerkPublishableKey().startsWith("pk_");
}
