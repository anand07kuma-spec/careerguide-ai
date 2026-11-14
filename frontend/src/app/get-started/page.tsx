import type { Metadata } from "next";
import { RolePicker } from "@/components/account/role-picker";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Get started",
  description:
    "Choose Student or Parent, then continue with Google to create your CareerGuide AI account or sign back in.",
  path: "/get-started",
});

export default function GetStartedPage() {
  return <RolePicker />;
}
