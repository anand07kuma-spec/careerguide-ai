"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, isOffline, setAuthToken } from "./api";
import { deviceId, rotateDeviceId } from "./device";
import type { GuestResult, OnboardingPayload, Session, Settings, StudentProfile, User } from "./types";

type Status = "loading" | "new-device" | "ready" | "offline";

/** A server that accepts the connection and then says nothing would otherwise
 * leave the student under "Checking your account…" with no way out. */
const CHECK_TIMEOUT_MS = 12000;

/** Only a 401 is evidence that this tab's credential was refused. */
function refusedByServer(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * How often an open page asks the server to keep its session going.
 *
 * A session ends after a day of quiet and a month of use, whichever comes first. Without
 * asking, a child who leaves the questionnaire open on a second monitor gets signed out
 * by a clock they cannot see; asking every few seconds would be a request per tab with
 * nothing to show for it. An hour sits between: six asks a day, each one moving an expiry
 * that would otherwise have run out.
 */
const RENEW_EVERY_MS = 60 * 60 * 1000;

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new ApiError(
            `The server did not answer within ${Math.round(ms / 1000)} seconds.`,
            0,
          ),
        ),
      ms,
    );
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

interface SessionValue {
  status: Status;
  user: User | null;
  profile: StudentProfile | null;
  // Never null: an offline session falls back to EMPTY_SETTINGS, so screens
  // don't have to invent their own defaults.
  settings: Settings;
  /** True for a student account; parents get the parent-only surfaces. */
  isStudent: boolean;
  isParent: boolean;
  completeOnboarding: (payload: OnboardingPayload) => Promise<Session>;
  /** Forget this device on the server and get a brand-new identity here. */
  startOver: () => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  saveProfile: (patch: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}

const EMPTY_SETTINGS: Settings = {
  // Matches the backend default: the guide opens in Hinglish and then follows
  // whichever language the student actually uses.
  language: "hinglish",
  voice: null,
  speak_responses: true,
  continuous_conversation: true,
  save_history: true,
  reduced_motion: false,
  high_contrast: false,
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);

  const apply = useCallback((next: Session) => {
    setUser(next.user);
    setProfile(next.profile);
    setSettings(next.settings);
    setStatus("ready");
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setProfile(null);
    setSettings(EMPTY_SETTINGS);
    setStatus("new-device");
  }, []);

  const reload = useCallback(async () => {
    // Ask who this browser is using only what a browser offers on its own: the session
    // cookie the server wrote. Nothing is read out of storage, because nothing was ever
    // put there — a token a script could read is a token a script could hand over.
    try {
      apply(await withDeadline(api.me(), CHECK_TIMEOUT_MS));
      return;
    } catch (error) {
      // A 401 is an answer, not a fault: this browser holds nothing the server
      // recognises, which is true of every first visit. It is consumed here and never
      // written to the console — the line a developer sees in the Network log is the
      // browser's own record of the status code, printed before this `catch` runs, and
      // no page code can suppress it. The next block is the same conversation continued.
      //
      // Anything else says nothing about this session, so it must not read as signed
      // out. A 503 from a cold server or a 429 from a rate limit used to fall through to
      // the guest probe below, and a browser whose account is only reachable by cookie
      // would be answered `known: false` and sent toward starting over. Now they reach
      // the retry screen, which says that nothing on this device was cleared.
      if (!refusedByServer(error)) {
        setStatus("offline");
        return;
      }
      setAuthToken(null);
    }

    // Nothing was accepted. Two different situations look identical from here, and the
    // device id tells them apart: a browser that has never been here, and a browser —
    // Safari and Firefox in strict mode — that will not keep a cookie set by a
    // cross-site request, so it has a valid account and no way to show it.
    try {
      const answer: GuestResult = await withDeadline(api.guest(deviceId()), CHECK_TIMEOUT_MS);
      if (answer.known && answer.session) {
        // In-memory only. On reload the cookie answers again where it is allowed to, and
        // this call answers where it is not; neither survives the tab being closed.
        setAuthToken(answer.session.token);
        apply(answer.session);
        return;
      }
      setStatus("new-device");
    } catch (error) {
      if (isOffline(error)) {
        setStatus("offline");
        return;
      }
      // An unusable device id (locked-down browser storage) still means: ask the
      // one question and let the student in. Nothing is lost, nothing is assumed.
      setStatus("new-device");
    }
  }, [apply]);

  // On mount, find out whether this browser already has an account. This cannot be
  // derived during render: a cookie only exists in the browser, so the server's first
  // paint has to show the same "checking your account" state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  // Keep a session that is actually in use from expiring underneath the child. A tab
  // that is hidden is the interesting case — an hour of quiet is exactly what the TTL
  // counts, and the tab coming back is the moment that has just happened.
  useEffect(() => {
    if (status !== "ready") return;
    if (typeof document === "undefined") return;
    const renew = () => {
      void api
        .refresh()
        // `extended: false` is the monthly ceiling answering, not an error: this session
        // ends when it says it will. A fresh sign-in from the same device is a fresh
        // session, which is what a ceiling is for rather than a way around it.
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 401) void reload();
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") renew();
    };
    const timer = setInterval(renew, RENEW_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, reload]);

  // Accessibility choices must reach CSS before first paint of the next route.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.reducedMotion = String(settings.reduced_motion);
    root.dataset.highContrast = String(settings.high_contrast);
  }, [settings.reduced_motion, settings.high_contrast]);

  const completeOnboarding = useCallback(
    async (payload: OnboardingPayload) => {
      // The device is the account: this id is the only handle the server keeps
      // for finding the work again on the next visit from this browser.
      const next = await api.onboarding({ ...payload, device_id: deviceId() });
      setAuthToken(next.token);
      apply(next);
      return next;
    },
    [apply],
  );

  const startOver = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      setAuthToken(null);
    }
    // Revoking the session is not enough: the device id would still be recognised on
    // the next page load and the same student would silently come back.
    setAuthToken(null);
    rotateDeviceId();
    clear();
  }, [clear]);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    try {
      setSettings(await api.updateSettings(patch));
    } catch (error) {
      // Roll the switch back to what the server actually holds, then let the
      // caller surface the failure — a toggle must not lie about being saved.
      const fresh = await api.me().catch(() => null);
      if (fresh) setSettings(fresh.settings);
      throw error;
    }
  }, []);

  const saveProfile = useCallback(async (patch: Record<string, unknown>) => {
    const next = await api.updateProfile(patch);
    if (next) setProfile(next);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      profile,
      settings,
      isStudent: user?.role === "student",
      isParent: user?.role === "parent",
      completeOnboarding,
      startOver,
      saveSettings,
      saveProfile,
      reload,
    }),
    [
      status,
      user,
      profile,
      settings,
      completeOnboarding,
      startOver,
      saveSettings,
      saveProfile,
      reload,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
