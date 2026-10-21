import { connection } from "next/server";
import { CounsellorPortalScreen } from "@/components/portal/portal-screens";

/** The practice's own screen, addressed by `?portal=` for the same reason the school's is:
 * a counsellor can work in one practice and sit on another school's roster at the same
 * time, and the two hold different clients. `connection()` is what makes reading that
 * query legal on a route `cacheComponents` would otherwise try to build statically. */
/** Blocks rather than streams: a practice's client list has nothing to show a placeholder,
 * and no snapshot of it belongs in a build artifact. */
export const instant = false;

export default async function CounsellorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  await connection();
  const { portal } = await searchParams;
  return <CounsellorPortalScreen slug={portal ?? null} />;
}
