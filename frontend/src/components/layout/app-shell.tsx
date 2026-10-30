"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Briefcase,
  Building2,
  ClipboardList,
  Compass,
  CreditCard,
  FileText,
  FileUser,
  GraduationCap,
  Home,
  Landmark,
  Lightbulb,
  ListChecks,
  Menu,
  Mic,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Split,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { classLabel, cn, initials } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { MyMembership } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  /** Short form used inside the mobile drawer, where the full label would wrap. */
  short: string;
  icon: typeof Home;
  group: "guide" | "explore" | "grow" | "family" | "portal";
  /**
   * The Home dashboard already offers this page as a labelled tile in its own
   * "Explore" section, so neither the desktop sidebar nor the mobile drawer names
   * it a second time — the two lists sat side by one another with the same labels
   * on one screen. A tile the phone's bottom bar already owns is hidden from the
   * grid below the `lg` breakpoint, so each destination is offered once on every
   * screen size.
   */
  tileOnly?: boolean;
  /**
   * Name this page in the mobile drawer anyway, whatever `tileOnly` and the bottom
   * bar would otherwise decide. Used for the three rows a student reaches for by
   * name — Home, AI Call and Scholarships — so the drawer is a list of the app's
   * destinations rather than a list of its leftovers.
   */
  inDrawer?: boolean;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Home", short: "Home", icon: Home, group: "guide", inDrawer: true },
  { href: "/app/call", label: "Start AI Call", short: "AI Call", icon: Mic, group: "guide", inDrawer: true },
  { href: "/app/chat", label: "Chat Instead", short: "Chat", icon: MessagesSquare, group: "guide" },
  { href: "/app/careers", label: "Career Explorer", short: "Careers", icon: Briefcase, group: "explore", tileOnly: true },
  { href: "/app/streams", label: "Choose your stream", short: "Streams", icon: Split, group: "explore", tileOnly: true },
  { href: "/app/exams", label: "Exams & entrances", short: "Exams", icon: ClipboardList, group: "explore", tileOnly: true },
  { href: "/app/interests", label: "Discover My Interests", short: "Interests", icon: Lightbulb, group: "explore", tileOnly: true },
  // No tile of its own on the dashboard, so this one stays in the sidebar.
  { href: "/app/assessments", label: "Assessments", short: "Assessments", icon: ListChecks, group: "explore" },
  { href: "/app/resources", label: "Resources", short: "Resources", icon: BookOpen, group: "explore", tileOnly: true },
  { href: "/app/scholarships", label: "Scholarships & Aid", short: "Scholarships", icon: Wallet, group: "explore", tileOnly: true, inDrawer: true },
  { href: "/app/institutes", label: "Institutes & Courses", short: "Institutes", icon: Building2, group: "explore", tileOnly: true },
  // Each of these three has a tile of its own in the dashboard's Explore grid, so
  // the sidebar and the drawer would only be a second place to say the same thing.
  { href: "/app/journey", label: "My Journey", short: "Journey", icon: Compass, group: "grow", tileOnly: true },
  { href: "/app/plans", label: "Study & Skill Plans", short: "Plans", icon: GraduationCap, group: "grow", tileOnly: true },
  { href: "/app/reports", label: "Reports", short: "Reports", icon: FileText, group: "grow", tileOnly: true },
  // No tile of its own either: Home's explore grid is eight tiles wide and a CV is a
  // thing you come back to before an application, not a thing to be pointed at daily.
  { href: "/app/resume", label: "My Resume", short: "Resume", icon: FileUser, group: "grow" },
  { href: "/parent", label: "Parent Dashboard", short: "Parent", icon: ShieldCheck, group: "family" },
  // `group: "family"` is not a label, it is a gate: a parent is shown only the
  // family rows, and the person who holds the card is a parent, so billing has to
  // live in this group or it would be invisible to the one account that can pay.
  { href: "/app/billing", label: "Billing & plan", short: "Billing", icon: CreditCard, group: "family" },
  { href: "/app/profile", label: "My Profile", short: "Profile", icon: UserRound, group: "family" },
  { href: "/app/settings", label: "Settings", short: "Settings", icon: Settings, group: "family" },
];

const GROUP_TITLES: Record<NavItem["group"], string> = {
  guide: "Talk with your guide",
  explore: "Explore",
  grow: "Your progress",
  // Rendered only for an account that appears on a portal's roster. The rows are not
  // written here because nobody can say in advance which school a device has joined;
  // see `portalRows` in `AppShell`.
  portal: "Your portals",
  family: "Account",
};

// The header avatar already goes to Settings, so the bar would waste a slot on a
// second route to the same page.
const MOBILE_NAV = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/careers", label: "Careers", icon: Briefcase },
  { href: "/app/call", label: "AI Call", icon: Mic },
  { href: "/app/plans", label: "Plans", icon: GraduationCap },
  { href: "/app/journey", label: "Journey", icon: Compass },
];

// The bottom bar is the nearest thing to a thumb on a phone, so wherever it has a
// slot, that is the one place the page is offered: the drawer drops these rows and
// the dashboard hides their tiles. Derived from the bar itself, because a sixth
// entry added there should stop being a duplicate without anyone remembering to
// edit a second list.
const BOTTOM_BAR_HREFS = new Set(MOBILE_NAV.map((item) => item.href));

function isActive(pathname: string, href: string) {
  // A portal row carries its slug in a query (`?portal=govt-senior-school-3f`) because
  // the brief named one dashboard path per kind. The highlight therefore compares the
  // path alone, which means two school portals of the same account both light up on
  // `/school/dashboard` — an honest statement of "you are inside a school portal", and
  // better than reading the query on the client, which would make every page that
  // mounts this shell dynamically rendered.
  const path = href.split("?")[0];
  if (path === "/app") return pathname === "/app";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * The portal rows, from the account's own membership list.
 *
 * Nothing is shown when the list is empty, when it failed to load, or when the only
 * rows are revoked: a sidebar that advertised a portal this device cannot open would
 * be a broken button, and the whole point of `/mine` is that the server decided this
 * account is on these rosters.
 */
function portalRows(mine: MyMembership[] | null): NavItem[] {
  if (!mine) return [];
  return mine
    .filter((membership) => membership.status === "active")
    .map((membership) => ({
      href: `/${membership.kind}/dashboard?portal=${encodeURIComponent(membership.slug)}`,
      label: membership.portal_title || membership.name,
      short: membership.portal_title || membership.name,
      icon: membership.kind === "school" ? Landmark : Users,
      group: "portal" as const,
    }));
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { status, user, profile, isParent } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const handFocusBackRef = useRef(false);

  const closeDrawer = useCallback((handFocusBack: boolean) => {
    handFocusBackRef.current = handFocusBack;
    setDrawerOpen(false);
  }, []);

  // Read above the early return below, because a hook that moves with the screen's
  // state is how React loses track of one. A failure to load the list is not shown to
  // the user: the group simply is not drawn, and a portal the account holds can still
  // be reached from a link or an invitation.
  const loadMine = useCallback(() => api.orgMine().catch(() => [] as MyMembership[]), []);
  const mine = useResource(loadMine);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer, drawerOpen]);

  // Opening moves focus into the menu; dismissing it by Escape, the ✕ or the
  // dimmed backdrop hands it back to the ☰ button. The menu hides itself with
  // `inert` rather than `aria-hidden`, because hiding a subtree that still holds
  // focus is exactly what browsers complain about.
  useEffect(() => {
    if (drawerOpen) {
      closeButtonRef.current?.focus();
      return;
    }
    if (!handFocusBackRef.current) return;
    handFocusBackRef.current = false;
    openButtonRef.current?.focus();
  }, [drawerOpen]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Wordmark />
          <p className="text-sm text-muted" role="status">
            {t("Getting your dashboard ready…")}
          </p>
        </div>
      </div>
    );
  }

  // A student tapping Parent Dashboard is bounced straight back to /app, because
  // that route is guarded for parents — so it is not offered to them. A parent
  // keeps the family pages; the student pages read a child's private answers,
  // which the backend only ever serves to that child.
  const items = NAV.filter((item) => {
    if (item.href === "/parent") return isParent;
    // A parent account holds no class, no interests and no assessments, so the
    // profile screen would show them nothing but blanks.
    if (item.href === "/app/profile") return !isParent;
    return !isParent || item.group === "family";
  }).concat(portalRows(mine.data));

  // The drawer names the app's destinations: what nothing else on a phone offers —
  // the conversation, the assessments, the CV, the account pages, any portal — plus
  // the three rows flagged `inDrawer`. Home and AI Call also sit in the bottom bar
  // and Scholarships also sits in the dashboard's Explore grid, so those three read
  // twice on a phone; they are here because a student looks for them by name and
  // expects to find them in the menu. Everything else stays in one place.
  const drawerItems = items.filter(
    (item) => item.inDrawer || (!item.tileOnly && !BOTTOM_BAR_HREFS.has(item.href)),
  );

  const sidebar = (
    <nav aria-label={t("Main")} className="flex h-full flex-col bg-navy text-white/80">
      <div className="px-5 py-5">
        <Link href="/" className="block">
          <Wordmark tone="white" />
        </Link>
      </div>

      <div className="cg-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {(["guide", "explore", "grow", "portal", "family"] as const).map((group) => {
          const groupItems = items.filter((item) => item.group === group && !item.tileOnly);
          if (!groupItems.length) return null;
          return (
            <div key={group}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                {t(GROUP_TITLES[group])}
              </p>
              <ul className="space-y-0.5">
                {groupItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => closeDrawer(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-brand text-white shadow-sm"
                            : "text-white/70 hover:bg-white/8 hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{t(item.label)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
            {initials(user?.display_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.display_name}</p>
            <p className="truncate text-[11px] text-white/50">
              {user?.role === "parent" ? t("Parent account") : classLabel(profile?.class_level) ?? t("Student")}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[264px_minmax(0,1fr)] print:block">
      <aside className="sticky top-0 hidden h-dvh lg:block print:hidden">{sidebar}</aside>

      {/* Mobile drawer. Only reachable through the ☰ button in the header, and the
          page behind it is dimmed and made non-interactive so the menu reads clearly
          instead of overlapping whatever the student was looking at. */}
      <div
        id="app-drawer"
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        inert={!drawerOpen}
      >
        <button
          type="button"
          aria-label={t("Close menu")}
          onClick={() => closeDrawer(true)}
          className={cn(
            "absolute inset-0 bg-navy/60 backdrop-blur-[2px] transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Main menu")}
          className={cn(
            "absolute inset-y-0 left-0 flex w-[288px] max-w-[86vw] flex-col bg-navy text-white/80 shadow-[0_0_70px_rgba(4,10,22,0.55)] ring-1 ring-white/10 transition-transform duration-300 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* The pages nothing else on this screen already links to, in two compact
              columns. Long labels would wrap, so the drawer uses short names. */}
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
            <Wordmark tone="white" compact />
            <button
              type="button"
              ref={closeButtonRef}
              onClick={() => closeDrawer(true)}
              aria-label={t("Close menu")}
              className="shrink-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <nav className="cg-scrollbar flex-1 overflow-y-auto px-3 pb-2">
            <ul className="grid grid-cols-2 gap-1.5">
              {drawerItems.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => closeDrawer(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-brand text-white"
                          : "text-white/70 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{t(item.short)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
              {initials(user?.display_name)}
            </span>
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-white">
              {user?.display_name}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col" inert={drawerOpen}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            ref={openButtonRef}
            onClick={() => setDrawerOpen(true)}
            aria-label={t("Open menu")}
            aria-controls="app-drawer"
            aria-expanded={drawerOpen}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 text-ink hover:border-brand/40 hover:text-brand"
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold">{t("Menu")}</span>
          </button>
          <Wordmark compact />
          <Link
            href="/app/settings"
            aria-label={t("Profile and settings")}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white"
          >
            {initials(user?.display_name)}
          </Link>
        </header>

        <main className="min-w-0 flex-1 pb-24 lg:pb-10 print:pb-0">{children}</main>
      </div>

      <nav
        aria-label={t("Quick navigation")}
        inert={drawerOpen}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
          {MOBILE_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const isCall = item.href === "/app/call";
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-brand" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full transition-all",
                      isCall
                        ? "h-11 w-11 bg-brand text-white shadow-[0_6px_18px_-6px_rgba(37,99,235,0.8)]"
                        : active
                          ? "h-8 w-8 bg-brand-mist"
                          : "h-8 w-8",
                    )}
                  >
                    <Icon className={cn(isCall ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
                  </span>
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Screen({
  title,
  description,
  action,
  badge,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8", className)}>
      {/* The one printable thing inside a screen is the document the student wrote, not
          this heading and its buttons — a CV that opens with the app's own page title is
          the app printing itself on the child's paper. */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 print:hidden sm:mb-7">
        <div className="min-w-0">
          {badge ? <div className="mb-2">{badge}</div> : null}
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{t(title)}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              {typeof description === "string" ? t(description) : description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
