import type { Metadata } from "next";
import { EmailConfirm } from "@/components/account/email-confirm";
import { NOINDEX, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Confirm your email address",
  description: "Open the link we mailed to switch on messages for this address.",
  path: "/email/confirm",
  robots: NOINDEX,
});

export default function EmailConfirmPage() {
  return <EmailConfirm />;
}
