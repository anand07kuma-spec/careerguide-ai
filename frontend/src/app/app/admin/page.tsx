import { redirect } from "next/navigation";

/**
 * `/app/admin` on its own has no screen: the area opens on the overview. A link that
 * landed on an empty page would look like a broken feature, so the address is answered
 * with a redirect instead, before the operator's access check has even been made.
 */
export default function AdminIndexRedirect(): never {
  redirect("/app/admin/dashboard");
}
