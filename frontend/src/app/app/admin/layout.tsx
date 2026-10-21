"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  ServerCog,
  ShieldCheck,
  University as UniversityIcon,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { ApiError, api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * The operator's area: `/app/admin/...`.
 *
 * Two jobs, and one deliberate omission.
 *
 * **The gate.** `/api/admin/*` is protected on the server by a router-level dependency
 * (`app/routers/admin.py`), so this layout is not what keeps anybody out — it is what
 * keeps six screens from each inventing their own version of the check that this
 * account is the admin one. One call to `/api/admin/me` decides the whole area, and
 * `children` is not rendered until it has. That matters for the data as well as the
 * design: a screen that never mounts never fires four requests that are going to be
 * refused.
 *
 * The flag is `users.is_admin`, set only by `python scripts/admin_grant.py --email
 * <address>` on the server. There is no signup, form or request body that can ask for
 * it, and `admin_test.py` fails if any schema in the API ever grows an `is_admin` field.
 * A closed account is answered with a 401 rather than a 403, because `get_current_user`
 * checks `is_active` before the flag is read; both refusals land on the same panel.
 *
 * **The nav, as a bar rather than a second sidebar.** These screens already sit inside
 * `AppShell`, which owns the site's sidebar, its header, its mobile drawer and its
 * focus handling. A second sidebar nested inside the first would be two columns of
 * links on a 1280-pixel laptop and an unusable drawer on a phone. So the operator gets
 * a labelled row above their own content, which is the same thing the portal dashboards
 * do inside this shell. The student's own navigation stays where it has always been.
 */

const ADMIN_NAV = [
  { href: "/app/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/app/admin/users", label: "Accounts", icon: Users },
  { href: "/app/admin/content", label: "Content", icon: BookOpen },
  { href: "/app/admin/exams", label: "Exams", icon: ClipboardList },
  { href: "/app/admin/leads", label: "Enquiries", icon: Inbox },
  // The study-abroad directory and the stories already had an operator screen before
  // this area existed. It is linked rather than rebuilt, because two copies of an edit
  // form are two chances for one of them to be wrong.
  { href: "/app/admin/study-abroad", label: "Study abroad", icon: UniversityIcon },
  { href: "/app/admin/settings", label: "Deployment", icon: ServerCog },
];

type Access = "checking" | "admin" | "forbidden" | "offline";

export default function AdminAreaLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const { status: session } = useSession();
  const pathname = usePathname();
  const [access, setAccess] = useState<Access>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session !== "ready") return;
    let active = true;
    api
      .adminMe()
      .then(() => active && setAccess("admin"))
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setAccess("forbidden");
        } else {
          setAccess("offline");
        }
      });
    return () => {
      active = false;
    };
  }, [session, attempt]);

  if (access === "checking") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <LoadingPanel label="Checking whether this account runs the site" />
      </div>
    );
  }

  if (access !== "admin") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <ErrorState
          title={access === "offline" ? "The server is not answering" : "These screens are not open to this account"}
          description={
            access === "offline"
              ? "The backend could not be reached, so it could not say whether this account holds the operator flag. Nothing has been cleared on this device."
              : "Only the account with the is_admin flag may see the counts, the accounts list or the catalogue. No page, form or sign-up can ask for that flag, and it is not a role a token carries."
          }
          extra={
            <div className="mt-3 space-y-2">
              <p className="text-xs leading-relaxed text-muted">
                {t("On the server, run this command for the confirmed address this account signs in with, then reload this page:")}{" "}
                <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px]">
                  python scripts/admin_grant.py --email the-address-on-the-account
                </code>{" "}
                {t("To take it back, add this option to the command:")}{" "}
                <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px]">--revoke</code>{" "}
                {t("Either way the change is written into the operator log.")}
              </p>
              {access === "offline" ? (
                <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                  {t("Check again")}
                </Button>
              ) : null}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <nav
        aria-label={t("Operator screens")}
        className="border-b border-line bg-surface/80"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2.5 sm:px-6">
          <Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
            {t("Operator")}
          </Badge>
          {ADMIN_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-brand-mist font-semibold text-brand-dark"
                    : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(item.label)}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
