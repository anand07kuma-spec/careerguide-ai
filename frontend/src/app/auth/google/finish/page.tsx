import type { Metadata } from "next";
import { GoogleFinish } from "@/components/account/google-finish";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { robots: NOINDEX };

export default function GoogleFinishPage() {
  return <GoogleFinish />;
}
