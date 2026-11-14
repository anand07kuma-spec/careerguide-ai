import type { Metadata } from "next";
import { ResetPassword } from "@/components/account/reset-password";
import { NOINDEX, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Choose a new password",
  description: "Set a new password for your CareerGuide AI account.",
  path: "/reset-password",
  robots: NOINDEX,
});

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
