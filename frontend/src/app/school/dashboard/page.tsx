import { connection } from "next/server";
import { SchoolPortalScreen } from "@/components/portal/portal-screens";

/**
 * Which school this screen shows comes from `?portal=`, because one account can be on
 * several rosters and a sidebar that picked one for them would be a guess. Nothing in the
 * query reaches a database: the address is sent to the backend with this browser's own
 * session, and a portal the caller has not joined answers 403 there rather than showing a
 * roster to a stranger.
 *
 * `connection()` is what lets a page read its own query at all under `cacheComponents`,
 * which would otherwise try to bake this route at build time with no request to ask.
 */
/** Blocks and renders the real portal for the signed-in device instead of streaming a
 * placeholder: there is nothing here that belongs in an HTML snapshot of nobody. */
export const instant = false;

export default async function SchoolDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  await connection();
  const { portal } = await searchParams;
  return <SchoolPortalScreen slug={portal ?? null} />;
}
