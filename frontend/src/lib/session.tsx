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
    const stored = api.readStoredToken();
    if (stored) {
      setAuthToken(stored);
      try {
        apply(await withDeadline(api.me(), CHECK_TIMEOUT_MS));
      } catch (error) {
        if (isOffline(error)) {
          // The stored token *is* the account: there is no password to type again.
          // A network that is merely down or slow must not throw the only copy away.
          setStatus("offline");
          return;
        }
        // A token the server refuses is genuinely stale. Ask the device again
        // rather than assuming a stranger is sitting at this keyboard.
        api.rememberToken(null);
      }
      return;
    }

    // No token in this browser. The device id alone decides whether this is the
    // same student coming back or somebody who has never been here.
    try {
      const answer: GuestResult = await withDeadline(api.guest(deviceId()), CHECK_TIMEOUT_MS);
      if (answer.known && answer.session) {
        api.rememberToken(answer.session.token);
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

  // On mount, reconcile this device's stored token with the server. This cannot
  // be derived during render: localStorage only exists in the browser, so the
  // server's first paint has to show the same "checking your account" state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

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
      api.rememberToken(next.token);
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
    // Revoking the token is not enough: the device id would still be recognised on
    // the next page load and the same student would silently come back.
    api.rememberToken(null);
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
