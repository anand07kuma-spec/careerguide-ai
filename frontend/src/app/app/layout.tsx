import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/route-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  // Students and parents both need this shell (parents use /app/settings),
  // so the role split is handled by the individual screens and the backend.
  return <RouteGuard access="any">{children}</RouteGuard>;
}
