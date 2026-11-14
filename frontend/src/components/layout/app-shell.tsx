"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronRight,
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
import { cn, initials } from "@/lib/utils";
import { useProfilePhoto } from "@/lib/use-profile-photo";
import { useResource } from "@/lib/use-resource";
import type { MyMembership } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  group: "guide" | "explore" | "grow" | "family" | "portal";
  /**
   * The Home dashboard already offers this page as a labelled tile in its own
   * "Explore" section, so neither the desktop sidebar nor the mobile drawer repeats
   * it — the two lists sat by one another with the same names on one screen.
   * The drawer keeps the guide rows and everything Explore has no tile for, which is
   * what a phone needs on top of the dashboard grid one tap away.
   */
  tileOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: Home, group: "guide" },
  { href: "/app/call", label: "Start AI Call", icon: Mic, group: "guide" },
  { href: "/app/chat", label: "Chat Instead", icon: MessagesSquare, group: "guide" },
  { href: "/app/careers", label: "Career Explorer", icon: Briefcase, group: "explore", tileOnly: true },
  { href: "/app/streams", label: "Choose your stream", icon: Split, group: "explore", tileOnly: true },
  { href: "/app/exams", label: "Exams & entrances", icon: ClipboardList, group: "explore", tileOnly: true },
  { href: "/app/interests", label: "Discover My Interests", icon: Lightbulb, group: "explore", tileOnly: true },
  // No tile of its own on the dashboard, so this one stays in the sidebar.
  { href: "/app/assessments", label: "Assessments", icon: ListChecks, group: "explore" },
  { href: "/app/resources", label: "Resources", icon: BookOpen, group: "explore", tileOnly: true },
  { href: "/app/scholarships", label: "Scholarships & Aid", icon: Wallet, group: "explore", tileOnly: true },
  { href: "/app/institutes", label: "Institutes & Courses", icon: Building2, group: "explore", tileOnly: true },
  { href: "/app/journey", label: "My Journey", icon: Compass, group: "grow", tileOnly: true },
  { href: "/app/plans", label: "Study & Skill Plans", icon: GraduationCap, group: "grow", tileOnly: true },
  { href: "/app/reports", label: "Reports", icon: FileText, group: "grow", tileOnly: true },
  // No tile of its own either: Home's explore grid is eight tiles wide and a CV is a
  // thing you come back to before an application, not a thing to be pointed at daily.
  { href: "/app/resume", label: "My Resume", icon: FileUser, group: "grow" },
  { href: "/parent", label: "Parent Dashboard", icon: ShieldCheck, group: "family" },
  // `group: "family"` is not a label, it is a gate: a parent is shown only the
  // family rows, and the person who holds the card is a parent, so billing has to
  // live in this group or it would be invisible to the one account that can pay.
  { href: "/app/billing", label: "Billing & plan", icon: CreditCard, group: "family" },
  { href: "/app/settings", label: "Settings", icon: Settings, group: "family" },
];

// The header avatar already goes to Settings, so the bar would waste a slot on a
// second route to the same page.
const STUDENT_MOBILE_NAV = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/careers", label: "Careers", icon: Briefcase },
  { href: "/app/call", label: "AI Call", icon: Mic },
  { href: "/app/plans", label: "Plans", icon: GraduationCap },
  { href: "/app/profile", label: "Profile", icon: UserRound },
];

/**
 * A parent's phone gets the parent routes, not a student's disabled ones. The
 * four student-only rows in the bar above all answer 403 on the server, so
 * showing them to a parent would be four buttons that cannot work on the one
 * screen where the drawer is furthest away.
 */
const PARENT_MOBILE_NAV = [
  { href: "/parent", label: "Dashboard", icon: ShieldCheck },
  { href: "/careers", label: "Careers", icon: Briefcase },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

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
      icon: membership.kind === "school" ? Landmark : Users,
      group: "portal" as const,
    }));
}

/**
 * The account card at the foot of the menu. It draws the same face the profile
 * page shows, the name the account was made with and the role it holds, because
 * this is the one row in the menu that is about the person reading it rather than
 * about a page. Clicking it is the way in to the profile.
 */
function ProfileCard({
  href,
  name,
  role,
  roleBadge = false,
  photoUrl,
  onNavigate,
}: {
  href: string;
  name: string | null | undefined;
  role: string;
  roleBadge?: boolean;
  photoUrl: string | null;
  onNavigate: () => void;
}) {
  const t = useT();
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group relative flex items-center gap-3 rounded-2xl border border-brand/35 bg-gradient-to-r from-brand/25 via-white/[0.05] to-transparent px-3 py-2.5 shadow-[0_16px_34px_-24px_rgba(41,149,255,0.95)] ring-1 ring-inset ring-white/5 transition-colors hover:border-brand/60 hover:from-brand/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-solid text-xs font-semibold text-on-brand ring-2 ring-brand/45">
        {photoUrl ? (
          // The bytes need the session and are already resized by the server, so a
          // loader has nothing to optimise here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
        <span
          aria-hidden
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-navy bg-profile-online shadow-[0_0_8px_rgba(52,211,153,0.9)]"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{name}</span>
        {roleBadge ? (
          <span className="mt-1 inline-flex items-center rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold leading-none text-white/75">
            {role}
          </span>
        ) : (
          <span className="mt-0.5 block truncate text-2xs text-white/55">{role}</span>
        )}
        <span className="sr-only">{t("Active")}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
        aria-hidden
      />
    </Link>
  );
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

  // The menu footer draws the same face as the profile hero, fetched through the
  // same hook, so a photo saved there reaches the menu as soon as the session
  // reloads. No picture is requested for an account that has not chosen one.
  const photo = useProfilePhoto(
    isParent || pathname === "/app/call" ? null : (profile?.profile_photo_url ?? null),
  );

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
            Getting your dashboard ready…
          </p>
        </div>
      </div>
    );
  }

  // The call is a focused, full-screen mode. Its own navy chrome replaces the
  // shell's header, sidebar and bottom bar, which would otherwise print the brand
  // twice and sit on top of the call composer.
  if (pathname === "/app/call") return <>{children}</>;

  // A student tapping Parent Dashboard is bounced straight back to /app, because
  // that route is guarded for parents — so it is not offered to them. A parent
  // keeps the family pages; the student pages read a child's private answers,
  // which the backend only ever serves to that child.
  const items = NAV.filter((item) => {
    if (item.href === "/parent") return isParent;
    return !isParent || item.group === "family";
  }).concat(portalRows(mine.data));

  const mobileNav = isParent ? PARENT_MOBILE_NAV : STUDENT_MOBILE_NAV;

  const sidebar = (
    <nav
      aria-label={t("Main")}
      className="relative flex h-full flex-col overflow-hidden bg-navy text-white/80"
    >
      {/* The same navy-and-glow language as the public hero, held back to a
          suggestion so the nav stays the most readable thing in the column. */}
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-20" />

      <div className="relative px-5 pb-5 pt-6">
        <Link href="/" className="block">
          <Wordmark tone="white" />
        </Link>
        {/* The tagline above already says what the guide is; the class range is
            student-facing copy, so a parent's column keeps just the three lines
            the brand is made of. */}
        {isParent ? null : (
          <p className="mt-2 text-2xs text-white/50">{t("A guide for classes 6 to 12")}</p>
        )}
      </div>

      <div className="cg-scrollbar relative flex-1 overflow-y-auto px-3 pb-6">
        {/* One even list: the groups only decide which rows a parent may see, so
            letting their boundaries add extra space made the column read as four
            ragged clusters of two or three rows each. */}
        <ul className="space-y-1">
          {items
            .filter((item) => !item.tileOnly)
            .map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => closeDrawer(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium leading-snug transition-all",
                      active
                        ? "bg-brand-solid text-on-brand shadow-[0_10px_24px_-14px_rgba(37,99,235,0.9)]"
                        : "text-white/70 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 break-words">{t(item.label)}</span>
                  </Link>
                </li>
              );
            })}
        </ul>
      </div>

      <div className="relative border-t border-white/10 p-3">
        <ProfileCard
          href={isParent ? "/app/settings/profile" : "/app/profile"}
          name={user?.display_name}
          role={isParent ? t("Parent") : t("Student")}
          roleBadge={isParent}
          photoUrl={photo.url}
          onNavigate={() => closeDrawer(false)}
        />
      </div>
    </nav>
  );

  return (
    <div className="cg-app-shell min-h-dvh bg-canvas lg:grid lg:grid-cols-[280px_minmax(0,1fr)] print:block">
      <a className="cg-skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
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
            "absolute inset-0 bg-overlay backdrop-blur-[2px] transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Main menu")}
          className={cn(
            "absolute inset-y-0 left-0 flex w-[288px] max-w-[86vw] flex-col overflow-hidden bg-navy text-white/80 shadow-[0_0_70px_rgba(4,10,22,0.55)] ring-1 ring-white/10 transition-transform duration-300 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div aria-hidden className="pointer-events-none absolute -left-20 top-8 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
          {/* The same rows as the desktop sidebar, one per line: full labels stay
              readable at 288px, and the phone already reaches the eight or so
              guide and account rows without a scrollbar. Pages with their own
              Explore tile stay one tap away on the dashboard grid. */}
          <div className="relative flex items-center justify-between gap-3 px-4 pb-3 pt-4">
            <Wordmark tone="white" compact={!isParent} />
            <button
              type="button"
              ref={closeButtonRef}
              onClick={() => closeDrawer(true)}
              aria-label={t("Close menu")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <nav className="cg-scrollbar relative flex-1 overflow-y-auto px-3 pb-2">
            <ul className="space-y-1">
              {items.filter((item) => !item.tileOnly).map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => closeDrawer(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium leading-snug transition-colors",
                        active
                          ? "bg-brand-solid text-on-brand"
                          : "text-white/70 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 break-words">{t(item.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="relative border-t border-white/10 p-3">
            <ProfileCard
              href={isParent ? "/app/settings/profile" : "/app/profile"}
              name={user?.display_name}
              role={isParent ? t("Parent") : t("Student")}
              roleBadge={isParent}
              photoUrl={photo.url}
              onNavigate={() => closeDrawer(false)}
            />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col" inert={drawerOpen}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            ref={openButtonRef}
            onClick={() => setDrawerOpen(true)}
            aria-label={t("Open menu")}
            aria-controls="app-drawer"
            aria-expanded={drawerOpen}
            className="flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-ink transition-colors hover:border-brand/40 hover:text-brand"
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold">{t("Menu")}</span>
          </button>
          <Wordmark compact />
          <Link
            href="/app/settings"
            aria-label={t("Profile and settings")}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-solid text-xs font-semibold text-on-brand"
          >
            {initials(user?.display_name)}
          </Link>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            // The bottom padding is the room the phone's tab bar needs and
            // nothing else: the pages already end in `Screen`'s own gutter, so
            // reserving `pb-10` here as well left a second, empty band below
            // every page from `lg` up. The inset is what stops a notched phone's
            // taller bar from sitting on the last row.
            "min-w-0 flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0",
            // The profile page is a studied composition of its own, so the canvas
            // behind it takes that page's surface instead of the app default.
            pathname === "/app/profile" && "bg-profile-page",
            // Settings landing and its seven pages share one warm page surface.
            pathname.startsWith("/app/settings") && "bg-settings-page",
          )}
        >
          {children}
        </main>
      </div>

      <nav
        aria-label={t("Quick navigation")}
        inert={drawerOpen}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
          {mobileNav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const isCall = item.href === "/app/call";
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-2xs font-medium transition-colors",
                    active ? "text-brand" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full transition-all",
                      isCall
                        ? "h-11 w-11 bg-brand-solid text-on-brand shadow-[0_6px_18px_-6px_rgba(37,99,235,0.8)]"
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
  titleClassName,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  /** The welcome headings on the parent dashboard are set like the Settings
   * titles; every other screen keeps the app's default sans heading. */
  titleClassName?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("mx-auto w-full max-w-page px-4 py-6 sm:px-6 sm:py-9", className)}>
      {/* The one printable thing inside a screen is the document the student wrote, not
          this heading and its buttons — a CV that opens with the app's own page title is
          the app printing itself on the child's paper. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 print:hidden sm:mb-8">
        <div className="min-w-0">
          {badge ? <div className="mb-2">{badge}</div> : null}
          <h1
            className={cn(
              titleClassName ??
                "text-2xl font-semibold tracking-tight text-heading sm:text-3xl",
            )}
          >
            {t(title)}
          </h1>
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
