import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { JoinForm } from "@/components/portal/join-form";
import { NOINDEX } from "@/lib/site";

/**
 * The link an invitation letter carries.
 *
 * It is a public URL with a token in its query, so it is kept out of the index and out of
 * `robots.txt` like the rest of the session surfaces: a search result for a live invite is
 * a page that promises a school to whoever types it, and a crawler that followed it would
 * be reading a link meant for one address.
 *
 * The request's own Host is read here rather than in the client because the portal a
 * branded subdomain belongs to cannot be recovered after the page has rendered — and it
 * is read as a *name*, never trusted as an authorisation: `JoinForm` only uses it to
 * decide whose heading and welcome note to paint, and the accept call carries the token.
 * `connection()` is what makes reading it legal under `cacheComponents`, which otherwise
 * wants this route static.
 */
export const metadata: Metadata = {
  robots: NOINDEX,
  title: { absolute: "Your invitation to a CareerGuide AI portal" },
};

/** The invitation is rendered into the HTML with its own token and its own Host, so this
 * route blocks rather than streaming a placeholder a family would watch fill in. */
export const instant = false;

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; portal?: string }>;
}) {
  await connection();
  const [{ token, portal }, headerList] = await Promise.all([searchParams, headers()]);
  return (
    <JoinForm
      token={token ?? null}
      portal={portal ?? null}
      host={headerList.get("host") ?? ""}
    />
  );
}
