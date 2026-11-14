import type { Metadata } from "next";
import { GoogleLogin } from "@/components/account/google-login";
import { NOINDEX, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Log in",
  description: "Sign in to CareerGuide AI with your email and password, or continue with Google. New students and parents can create an account here.",
  path: "/login",
  robots: NOINDEX,
});

export default function LoginPage() {
  return <GoogleLogin />;
}
