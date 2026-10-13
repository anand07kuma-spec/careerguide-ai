/** Typed client for the FastAPI backend. Credentials never live here. */

import type {
  Career,
  CareerReport,
  Category,
  ChatMessage,
  ChatReply,
  ConsentRecord,
  ConversationInfo,
  GuardianLink,
  Health,
  Institution,
  InterestPrompt,
  InterestSummary,
  Journey,
  OnboardingPayload,
  Observation,
  ParentChild,
  ParentGuidance,
  ParentSummary,
  RecommendationSet,
  Resource,
  SavedCareer,
  Session,
  Settings,
  ShareCode,
  Scholarship,
  StudyPlan,
  ThemeKey,
  VoiceInfo,
} from "./types";

export const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

/**
 * Speech comes back either as a `data:audio/mpeg` URL the reply already carries,
 * or as a path on the backend — which is a different origin from this app — so a
 * path must be made absolute before an <audio> element can load it.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:)/i.test(url)) return url;
  return `${BACKEND_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** A dead backend must read as "offline", not as a stack trace. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

let token: string | null = null;
export function setAuthToken(next: string | null) {
  token = next;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(
      "Cannot reach the CareerGuide AI server right now. It may be starting up or " +
        "temporarily offline — please try again in a moment.",
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      (data && typeof data === "object" && typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : null) ??
      // FastAPI validation errors arrive as an array of { loc, msg } objects.
      (Array.isArray(data) && data.length > 0
        ? "Some answers need fixing before this can be saved."
        : null) ??
      `The server responded with ${response.status}.`;
    if (response.status === 401) clearStoredToken();
    throw new ApiError(detail, response.status);
  }

  return data as T;
}

// The token lives in localStorage so a refresh keeps the session. It holds no
// secrets about the child beyond an opaque id.
const TOKEN_KEY = "careerguide.token";

function clearStoredToken() {
  token = null;
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

export const api = {
  readStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  rememberToken(next: string | null) {
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(TOKEN_KEY, next);
    else window.localStorage.removeItem(TOKEN_KEY);
    setAuthToken(next);
  },

  health: () => request<Health>("/api/health"),

  onboarding: (payload: OnboardingPayload) =>
    request<Session>("/api/auth/onboarding", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<Session>("/api/auth/me"),
  updateSettings: (patch: Partial<Settings>) =>
    request<Settings>("/api/auth/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  updateProfile: (patch: Record<string, unknown>) =>
    request<Session["profile"]>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(patch) }),
  consent: (scope: "profile" | "voice" | "history_sharing", granted: boolean) =>
    request<ConsentRecord>("/api/auth/consent", {
      method: "POST",
      body: JSON.stringify({ scope, granted }),
    }),
  listConsent: () => request<ConsentRecord[]>("/api/auth/consent"),
  logout: async () => {
    // Revoke on the server first; clearing the local token afterwards keeps the
    // request authenticated so the session really ends.
    try {
      await request<void>("/api/auth/logout", { method: "POST" });
    } finally {
      clearStoredToken();
    }
  },

  shareCode: () => request<ShareCode>("/api/auth/share-code"),
  newShareCode: () => request<ShareCode>("/api/auth/share-code/new", { method: "POST" }),
  revokeShareCode: () => request<ShareCode>("/api/auth/share-code", { method: "DELETE" }),
  linkChild: (code: string, relationship?: string | null) =>
    request<GuardianLink[]>("/api/auth/link-child", {
      method: "POST",
      body: JSON.stringify({ code, relationship: relationship ?? null }),
    }),
  guardians: () => request<GuardianLink[]>("/api/auth/guardians"),
  setTranscriptSharing: (guardianshipId: number, share_transcripts: boolean) =>
    request<GuardianLink>(`/api/auth/guardians/${guardianshipId}/transcripts`, {
      method: "PATCH",
      body: JSON.stringify({ share_transcripts }),
    }),
  removeGuardian: (guardianshipId: number) =>
    request<void>(`/api/auth/guardians/${guardianshipId}`, { method: "DELETE" }),

  categories: () => request<Category[]>("/api/careers/categories"),
  careers: (params: { search?: string; category?: string; theme?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
    ).toString();
    return request<Career[]>(`/api/careers${query ? `?${query}` : ""}`);
  },
  career: (slug: string) => request<Career>(`/api/careers/${encodeURIComponent(slug)}`),
  savedCareers: () => request<SavedCareer[]>("/api/careers/saved"),
  saveCareer: (id: number) =>
    request<{ saved: boolean; title: string; message?: string }>(`/api/careers/${id}/save`, {
      method: "POST",
    }),
  unsaveCareer: (id: number) =>
    request<void>(`/api/careers/${id}/save`, { method: "DELETE" }),

  startConversation: (kind: "chat" | "voice", language: string) =>
    request<ConversationInfo>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ kind, language }),
    }),
  sendMessage: async (sessionId: number, message: string, speak: boolean) => {
    const reply = await request<ChatReply>(`/api/conversations/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, speak }),
    });
    return { ...reply, audio_url: mediaUrl(reply.audio_url) };
  },
  messages: (sessionId: number) => request<ChatMessage[]>(`/api/conversations/${sessionId}/messages`),
  /** Local-only check: it stores nothing, it just says whether to show help contacts. */
  safetyCheck: (text: string) =>
    request<{ needs_support: boolean }>(`/api/conversations/safety-check?text=${encodeURIComponent(text)}`),
  endConversation: (sessionId: number) =>
    request<ConversationInfo>(`/api/conversations/${sessionId}/end`, { method: "POST" }),
  clearConversation: (sessionId: number) =>
    request<void>(`/api/conversations/${sessionId}/clear`, { method: "POST" }),
  listConversations: () => request<ConversationInfo[]>("/api/conversations"),

  speak: async (text: string, language: string, voice?: string | null) => {
    const result = await request<{ audio_url: string; provider: string }>("/api/voice/speak", {
      method: "POST",
      body: JSON.stringify({ text, language, voice: voice ?? null }),
    });
    return { ...result, audio_url: mediaUrl(result.audio_url) ?? result.audio_url };
  },
  voices: () => request<VoiceInfo>("/api/voice/voices"),

  interestPrompts: (language?: string) =>
    request<{ prompts: InterestPrompt[]; note: string; language: string }>(
      `/api/interests/prompts${language ? `?language=${encodeURIComponent(language)}` : ""}`,
    ),
  answerInterest: (prompt_id: string, answer: string, session_id?: number | null) =>
    request<{ saved_themes: { theme: ThemeKey; label: string }[]; message: string }>(
      "/api/interests/answers",
      { method: "POST", body: JSON.stringify({ prompt_id, answer, session_id: session_id ?? null }) },
    ),
  observations: () => request<Observation[]>("/api/interests/observations"),
  interestSummary: () => request<InterestSummary>("/api/interests/summary"),

  recommendations: () => request<RecommendationSet>("/api/recommendations"),
  persistRecommendations: () => request<RecommendationSet["recommendations"]>("/api/recommendations/persist", { method: "POST" }),

  journey: () => request<Journey>("/api/journey"),
  journeyEvents: (limit = 60) => request<Journey["events"]>(`/api/journey/events?limit=${limit}`),

  plans: () => request<StudyPlan[]>("/api/study-plans"),
  createPlan: (payload: { goal: string; title?: string; career_id?: number | null }) =>
    request<StudyPlan>("/api/study-plans", { method: "POST", body: JSON.stringify(payload) }),
  addPlanItem: (planId: number, payload: { title: string; detail?: string; estimated_effort?: string }) =>
    request<StudyPlan["items"][number]>(`/api/study-plans/${planId}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setPlanItemStatus: (planId: number, itemId: number, status: string) =>
    request<StudyPlan["items"][number]>(`/api/study-plans/${planId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deletePlanItem: (planId: number, itemId: number) =>
    request<void>(`/api/study-plans/${planId}/items/${itemId}`, { method: "DELETE" }),
  deletePlan: (planId: number) => request<void>(`/api/study-plans/${planId}`, { method: "DELETE" }),

  resources: (params: { search?: string; category?: string; kind?: string; language?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
    ).toString();
    return request<Resource[]>(`/api/resources${query ? `?${query}` : ""}`);
  },
  resourceCategories: () => request<string[]>("/api/resources/categories"),

  scholarships: (params: { search?: string; state?: string; level?: string; scope?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
    ).toString();
    return request<Scholarship[]>(`/api/scholarships${query ? `?${query}` : ""}`);
  },
  institutions: (
    params: { search?: string; state?: string; career_area?: string; institution_type?: string; mode?: string } = {},
  ) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
    ).toString();
    return request<Institution[]>(`/api/institutions${query ? `?${query}` : ""}`);
  },

  generateReport: () => request<CareerReport>("/api/reports", { method: "POST" }),
  latestReport: () => request<CareerReport | null>("/api/reports/latest"),
  deleteReport: (id: number) => request<void>(`/api/reports/${id}`, { method: "DELETE" }),

  parentChildren: () => request<ParentChild[]>("/api/parent/children"),
  parentSummary: (studentId: number) =>
    request<ParentSummary>(`/api/parent/summary?student_id=${studentId}`),
  parentGuidance: (studentId: number, concern: string) =>
    request<ParentGuidance>(
      `/api/parent/guidance?student_id=${studentId}&concern=${encodeURIComponent(concern)}`,
    ),
};

/** Turns a backend media path into an absolute URL for an <audio> element. */
export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BACKEND_URL}${path}`;
}
