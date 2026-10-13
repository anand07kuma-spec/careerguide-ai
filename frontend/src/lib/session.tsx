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
import { api, setAuthToken } from "./api";
import type { OnboardingPayload, Session, Settings, StudentProfile, User } from "./types";

type Status = "loading" | "signed-out" | "ready";

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
  signIn: (code: string) => Promise<Session>;
  signOut: () => Promise<void>;
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

  const reload = useCallback(async () => {
    const stored = api.readStoredToken();
    if (!stored) {
      setAuthToken(null);
      setStatus("signed-out");
      return;
    }
    setAuthToken(stored);
    try {
      apply(await api.me());
    } catch {
      // A stale token should return the user to onboarding, not a dead screen.
      api.rememberToken(null);
      setStatus("signed-out");
    }
  }, [apply]);

  useEffect(() => {
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
      const next = await api.onboarding(payload);
      api.rememberToken(next.token);
      apply(next);
      // The caller has to show the come-back code, so it travels back out. It is
      // never stored on this device — holding it in memory for one screen is the
      // whole point of a code meant to be written down.
      return next;
    },
    [apply],
  );

  const signIn = useCallback(
    async (code: string) => {
      const next = await api.login(code);
      api.rememberToken(next.token);
      apply(next);
      return next;
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      setAuthToken(null);
    }
    api.rememberToken(null);
    setUser(null);
    setProfile(null);
    setStatus("signed-out");
  }, []);

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
      signIn,
      signOut,
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
      signIn,
      signOut,
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
