import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/route-guard";

export default function ParentLayout({ children }: { children: ReactNode }) {
  return <RouteGuard access="parent">{children}</RouteGuard>;
}
