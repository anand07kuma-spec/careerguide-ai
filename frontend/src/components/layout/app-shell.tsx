"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Briefcase,
  Building2,
  Compass,
  FileText,
  GraduationCap,
  Home,
  Lightbulb,
  Menu,
  Mic,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { useSession } from "@/lib/session";
import { classLabel, cn, initials } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  group: "guide" | "explore" | "grow" | "family";
}

const NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: Home, group: "guide" },
  { href: "/app/call", label: "Start AI Call", icon: Mic, group: "guide" },
  { href: "/app/chat", label: "Chat Instead", icon: MessagesSquare, group: "guide" },
  { href: "/app/careers", label: "Career Explorer", icon: Briefcase, group: "explore" },
  { href: "/app/interests", label: "Discover My Interests", icon: Lightbulb, group: "explore" },
  { href: "/app/resources", label: "Resources", icon: BookOpen, group: "explore" },
  { href: "/app/scholarships", label: "Scholarships & Aid", icon: Wallet, group: "explore" },
  { href: "/app/institutes", label: "Institutes & Courses", icon: Building2, group: "explore" },
  { href: "/app/journey", label: "My Journey", icon: Compass, group: "grow" },
  { href: "/app/plans", label: "Study & Skill Plans", icon: GraduationCap, group: "grow" },
  { href: "/app/reports", label: "Reports", icon: FileText, group: "grow" },
  { href: "/parent", label: "Parent Dashboard", icon: ShieldCheck, group: "family" },
  { href: "/app/settings", label: "Settings", icon: Settings, group: "family" },
];

const GROUP_TITLES: Record<NavItem["group"], string> = {
  guide: "Talk with your guide",
  explore: "Explore",
  grow: "Your progress",
  family: "Account",
};

const MOBILE_NAV = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/careers", label: "Careers", icon: Briefcase },
  { href: "/app/call", label: "AI Call", icon: Mic },
  { href: "/app/journey", label: "Journey", icon: Compass },
  { href: "/app/settings", label: "Profile", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, user, profile, isParent, signOut } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const handFocusBackRef = useRef(false);

  const closeDrawer = useCallback((handFocusBack: boolean) => {
    handFocusBackRef.current = handFocusBack;
    setDrawerOpen(false);
  }, []);

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

  const items = NAV.filter((item) =>
    isParent ? item.group === "family" || item.href === "/parent" || item.href === "/app/settings" : true,
  );

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col bg-navy text-white/80">
      <div className="px-5 py-5">
        <Link href="/" className="block">
          <Wordmark tone="white" />
        </Link>
      </div>

      <div className="cg-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {(["guide", "explore", "grow", "family"] as const).map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                {GROUP_TITLES[group]}
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
                        <span className="truncate">{item.label}</span>
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
              {user?.role === "parent" ? "Parent account" : classLabel(profile?.class_level) ?? "Student"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      {/* Mobile drawer. Only reachable through the ☰ button in the header, and the
          page behind it is dimmed and made non-interactive so the menu reads clearly
          instead of overlapping whatever the student was looking at. */}
      <div
        id="app-drawer"
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-label="Main menu"
        inert={!drawerOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => closeDrawer(true)}
          className={cn(
            "absolute inset-0 bg-navy/60 backdrop-blur-[2px] transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[288px] max-w-[86vw] bg-navy shadow-[0_0_70px_rgba(4,10,22,0.55)] ring-1 ring-white/10 transition-transform duration-300 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
          <button
            type="button"
            ref={closeButtonRef}
            onClick={() => closeDrawer(true)}
            aria-label="Close menu"
            className="absolute right-3 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col" inert={drawerOpen}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            ref={openButtonRef}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-controls="app-drawer"
            aria-expanded={drawerOpen}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 text-ink hover:border-brand/40 hover:text-brand"
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold">Menu</span>
          </button>
          <Wordmark compact />
          <Link
            href="/app/settings"
            aria-label="Profile and settings"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white"
          >
            {initials(user?.display_name)}
          </Link>
        </header>

        <main className="min-w-0 flex-1 pb-24 lg:pb-10">{children}</main>
      </div>

      <nav
        aria-label="Quick navigation"
        inert={drawerOpen}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
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
                  {item.label}
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
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-7">
        <div className="min-w-0">
          {badge ? <div className="mb-2">{badge}</div> : null}
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
