/** Typed client for the FastAPI backend. Credentials never live here.
 *
 * "Here" means this module, and it means it literally: the session a browser signs with
 * is an `httpOnly` cookie the server writes and the browser attaches, which no page code
 * can read, write or hand to anything else. The one value this file does hold is a session
 * string for the length of one page load — see `setAuthToken` — and it exists only because
 * some browsers refuse to keep a cookie across two origins, which this deployment is.
 * Nothing here is written to `localStorage`, `sessionStorage` or any other store a script
 * could reach.
 */

import type { ZodType } from "zod";
import {
  answerReceiptSchema,
  catalogueSchema,
  pdfReportListSchema,
  pdfReportSchema,
  resultSchema,
  sessionSchema,
  sittingListSchema,
  startReceiptSchema,
  type AnswerReceipt,
  type AssessmentCatalogue,
  type AssessmentResult,
  type AssessmentSession,
  type AssessmentType,
  type PdfReport,
  type Sitting,
  type StartReceipt,
} from "./assessments";
import type {
  AcceptInput,
  AcceptResult,
  AdminBlogStatus,
  AdminCareerPage,
  AdminCareerPatch,
  AdminCareerRow,
  AdminDeployment,
  AdminQuestionPage,
  AdminQuestionPatch,
  AdminQuestionRow,
  AdminSummary,
  AdminUserPage,
  AdminUserRow,
  AuditPage,
  Billing,
  Branding,
  BrandingInput,
  Career,
  CareerReport,
  Category,
  ChatMessage,
  ChatReply,
  ClerkStatus,
  ConsentRecord,
  ConversationInfo,
  ExamAdminRow,
  ExamCreateInput,
  ExamGroupAdminRow,
  ExamGroupCard,
  ExamGroupCreateInput,
  ExamGroupUpdateInput,
  ErasureOut,
  ExamUpdateInput,
  GuardianLink,
  GuestResult,
  Health,
  Institution,
  InterestPrompt,
  InterestSummary,
  InterviewLine,
  InterviewTurn,
  InviteInput,
  InviteResult,
  Journey,
  MemberAdminRow,
  MemberRow,
  MyMembership,
  OnboardingPayload,
  Observation,
  OrgKind,
  Organization,
  ParentChild,
  ParentGuidance,
  ParentSummary,
  Payment,
  PaymentConfirmation,
  PaymentOrder,
  PlanDetail,
  PortalAnalytics,
  PortalBranding,
  PortalSummary,
  Pricing,
  RecommendationSet,
  Resource,
  Resume,
  ResumeInput,
  ResumeSuggestion,
  SavedCareer,
  Session,
  SessionNote,
  SessionRenewal,
  Settings,
  ShareCode,
  Scholarship,
  StudyCountry,
  StudyCountryCard,
  StudyLeadAdmin,
  StudyLeadHandle,
  StudyLeadIn,
  StudyLeadOut,
  StudyPlan,
  StudyService,
  StudyStory,
  StudyStoryAdmin,
  StudyStoryInput,
  ThemeKey,
  Tier,
  UniversityAdmin,
  UniversityCreate,
  UniversitySummary,
  UniversityUpdate,
  VoiceInfo,
} from "./types";

export const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

/**
 * Which address to fetch from, depending on who is fetching.
 *
 * `NEXT_PUBLIC_BACKEND_URL` is the address the *browser* can reach, which on a
 * laptop is `localhost:8000`. Inside a container that same string is the web
 * container itself, so every server-rendered read — `/careers`, `/blog`, the
 * sitemap — failed with "could not be reached" while the same app worked
 * perfectly in the browser next to it. `BACKEND_INTERNAL_URL` gives the server
 * half the docker-network name (`http://api:8000`) without ever telling the
 * browser about a host it cannot resolve; it is not `NEXT_PUBLIC_`, so it is
 * stripped out of the client bundle rather than shipped in it.
 */
const SERVER_BACKEND_URL = (
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

/** Which address to fetch from: a browser keeps the public one, a server render
 * uses the internal one when the deployment gave it. */
export function apiBase(): string {
  return typeof window === "undefined" ? SERVER_BACKEND_URL : BACKEND_URL;
}

/**
 * Speech comes back either as a `data:` URL the reply already carries (mp3 from
 * Microsoft, WAV from Gemini), or as a path on the backend — which is a different
 * origin from this app — so a path must be made absolute before an <audio>
 * element can load it.
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

/**
 * The session this page load was handed, or null.
 *
 * A cookie is normally enough, and this is the fallback for the browsers where it is not:
 * this site's page and its API are two hosts, and Safari keeps a cookie set by a cross-site
 * fetch to itself. Without the header path such a browser can start a session and then
 * never prove it holds one. It lives in this module's memory, is never written to any
 * storage, and is gone when the tab is closed or the page reloaded — at which point
 * `lib/session.tsx` asks the server for a session again, by cookie where the browser
 * supports it and by device id where it does not.
 */
let token: string | null = null;
export function setAuthToken(next: string | null) {
  token = next;
}

function dropInMemoryToken() {
  token = null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      // The session cookie is attached to this request and accepted from the reply. With
      // the default `same-origin` a cross-origin API call would run with no credential at
      // all, and the child would be a stranger to their own account on every screen.
      credentials: "include",
    });
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
    if (response.status === 401) dropInMemoryToken();
    throw new ApiError(detail, response.status);
  }

  return data as T;
}

/**
 * Assessment payloads are checked against `lib/assessments.ts` before a screen sees
 * them. These numbers go on a child's result page, so a shape that changed in
 * transit is a visible error rather than a blank space next to "Building and doing".
 */
async function checked<T>(schema: ZodType<T>, path: string, init: RequestInit = {}): Promise<T> {
  const data = await request<unknown>(path, init);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(
      "The answers came back in a form this screen does not understand. Nothing was lost — please reload.",
      502,
    );
  }
  return parsed.data;
}

/**
 * The PDF comes back as bytes, so it cannot go through `request`, which reads a body
 * as JSON. It carries the same two credentials and no others: the session cookie by
 * `credentials`, the in-memory string in a header. `/api/reports/pdf/{id}` is a route
 * behind them rather than a public link, so a report never becomes a URL that works in
 * an address bar or in a shared laptop's history. Callers turn the blob into an object
 * URL that dies with the page.
 */
async function binary(path: string): Promise<Blob> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      headers,
      cache: "no-store",
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the CareerGuide AI server right now. It may be starting up or " +
        "temporarily offline — please try again in a moment.",
      0,
    );
  }

  if (!response.ok) {
    if (response.status === 401) dropInMemoryToken();
    let message = `The server responded with ${response.status}.`;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* a body that is not JSON has no reason worth repeating */
    }
    throw new ApiError(message, response.status);
  }
  return response.blob();
}

/** Builds a query string, dropping the filters a screen never chose. */
function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const api = {
  health: () => request<Health>("/api/health"),

  onboarding: (payload: OnboardingPayload) =>
    request<Session>("/api/auth/onboarding", { method: "POST", body: JSON.stringify(payload) }),
  /** Ask whether this device has been here before. A new device is a normal
   * answer, not an error, so the app can go straight to the one question. */
  guest: (device_id: string) =>
    request<GuestResult>("/api/auth/guest", { method: "POST", body: JSON.stringify({ device_id }) }),
  me: () => request<Session>("/api/auth/me"),
  /**
   * Ask the server to push this session's expiry back. It needs a session to work, and
   * it cannot create one — the point of calling it from a timer is that a questionnaire
   * left open for hours keeps the child's place, while a tab that stopped asking loses
   * the session a day later rather than a month later. `extended: false` is the ceiling
   * answering, which is why the caller can turn it into words instead of a silent fail.
   */
  refresh: () => request<SessionRenewal>("/api/auth/refresh", { method: "POST" }),
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
    // Revoke on the server first; the cookie and the header both ride that request, so
    // the session really ends rather than only forgetting its own address. The server
    // answers with a `Set-Cookie` that expires the cookie, and this clears the
    // in-memory copy — which is the only one a page ever had.
    try {
      await request<void>("/api/auth/logout", { method: "POST" });
    } finally {
      dropInMemoryToken();
    }
  },

  /**
   * Erase this account: its conversations, assessments, reports, plans, saved careers,
   * settings, consents and sessions, with the row left holding nothing but the date.
   *
   * There is no body — this app asks for no password or address, so the session that
   * arrived is the only proof of whose account it is, which is why the screen behind this
   * call has to be the thing that stops a child pressing it. The server also ends the
   * session and expires the cookie in the same response, so `dropInMemoryToken` runs even
   * when the call fails and the caller is left on a screen that no longer has credentials.
   * The answer is the count of what was removed and the list of what deliberately stays.
   */
  deleteAccount: async () => {
    try {
      return await request<ErasureOut>("/api/users/me", { method: "DELETE" });
    } finally {
      dropInMemoryToken();
    }
  },

  /**
   * The optional email sign-in. `session` is a Clerk session token: this browser
   * gets it from Clerk, and the server asks *Clerk* whose it is. No request here
   * names a user id, so there is nothing for a caller to forge — and the answer to
   * `clerkEnter` is this app's own bearer token, the same credential every other
   * screen uses. An email sign-in on its own reaches no data at all.
   */
  clerkStatus: () => request<ClerkStatus>("/api/auth/clerk"),
  clerkLink: (session: string) =>
    request<ClerkStatus>("/api/auth/clerk/link", {
      method: "POST",
      body: JSON.stringify({ session }),
    }),
  clerkUnlink: () => request<ClerkStatus>("/api/auth/clerk/link", { method: "DELETE" }),
  clerkEnter: (session: string) =>
    request<Session>("/api/auth/clerk/enter", {
      method: "POST",
      body: JSON.stringify({ session }),
    }),

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

  /**
   * The exam map, in one call: every door and the exams standing under it, in the order
   * the page prints them.
   *
   * This used to be a `const` in this bundle. It is a read now so that a wrong sentence
   * about NEET can be corrected by an operator without a deploy — and the two fields the
   * API can withhold, `exam_date` and `fee_note`, come back `null` on any row nobody has
   * read off a source. `null` is not a gap to fill in on the screen: it is the page naming
   * this year's official notification as the authority, which is what it did before.
   */
  exams: () => request<ExamGroupCard[]>("/api/exams"),

  startConversation: (kind: "chat" | "voice", language: string) =>
    request<ConversationInfo>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ kind, language }),
    }),
  /**
   * One message to the guide.
   *
   * `planOf` is the result whose "discuss this plan" button opened this chat, and it is
   * sent only while that card is pinned. The server checks the id belongs to this student
   * before it tells the model anything about the plan, and the field is left null for
   * every other message so a plan never travels into an unrelated conversation.
   */
  sendMessage: async (
    sessionId: number,
    message: string,
    speak: boolean,
    planOf?: number | null,
  ) => {
    const reply = await request<ChatReply>(`/api/conversations/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, speak, plan_of: planOf ?? null }),
    });
    return { ...reply, audio_url: mediaUrl(reply.audio_url) };
  },
  messages: (sessionId: number) => request<ChatMessage[]>(`/api/conversations/${sessionId}/messages`),
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

  // The three questionnaires. Item wording follows `language`; ownership comes from
  // the bearer token, so no id passed here can reach another family's answers.
  /** Every questionnaire this student has finished, newest first — the profile
   * page's list, as opposed to `assessments()`, which is the one sitting to continue. */
  sittings: (language?: string) =>
    checked<Sitting[]>(
      sittingListSchema,
      `/api/assessments/history${language ? `?language=${encodeURIComponent(language)}` : ""}`,
    ),
  assessments: (language?: string) =>
    checked<AssessmentCatalogue>(
      catalogueSchema,
      `/api/assessments${language ? `?language=${encodeURIComponent(language)}` : ""}`,
    ),
  startAssessment: (type: AssessmentType, language: string) =>
    checked<StartReceipt>(startReceiptSchema, `/api/assessments/${type}/start`, {
      method: "POST",
      body: JSON.stringify({ language }),
    }),
  assessmentSession: (assessmentId: number) =>
    checked<AssessmentSession>(sessionSchema, `/api/assessments/session/${assessmentId}/questions`),
  answerAssessment: (assessmentId: number, code: string, value: string) =>
    checked<AnswerReceipt>(answerReceiptSchema, `/api/assessments/session/${assessmentId}/answer`, {
      method: "POST",
      body: JSON.stringify({ code, value }),
    }),
  submitAssessment: (assessmentId: number, language?: string) =>
    checked<AssessmentResult>(resultSchema, `/api/assessments/session/${assessmentId}/submit`, {
      method: "POST",
      body: JSON.stringify(language ? { language } : {}),
    }),
  assessmentResult: (resultId: number, language?: string) =>
    checked<AssessmentResult>(
      resultSchema,
      `/api/assessments/result/${resultId}${language ? `?language=${encodeURIComponent(language)}` : ""}`,
    ),
  /**
   * Ask the configured model to rewrite the plan on a finished result.
   *
   * The route answers with the whole result, not just the plan, because that is what the
   * card needs and what a GET would have returned anyway. When the model cannot be reached
   * or answers in a form nothing can use, the same payload comes back holding the rules
   * plan plus one sentence saying which of the two failures happened — the plan is never
   * quietly swapped for a different one under the student.
   */
  assessmentRoadmap: (resultId: number, language?: string) =>
    checked<AssessmentResult>(
      resultSchema,
      `/api/assessments/result/${resultId}/roadmap${language ? `?language=${encodeURIComponent(language)}` : ""}`,
      { method: "POST" },
    ),

  // The printed version of a student's questionnaires. `language` is which language
  // the *page* is printed in; the answers keep the language they were given in.
  generatePdfReport: (assessmentId: number, language?: string) =>
    checked<PdfReport>(pdfReportSchema, "/api/reports/generate", {
      method: "POST",
      body: JSON.stringify(language ? { assessment_id: assessmentId, language } : { assessment_id: assessmentId }),
    }),
  pdfReports: () => checked(pdfReportListSchema, "/api/reports/pdf"),
  pdfReportFile: (reportId: number) => binary(`/api/reports/pdf/${reportId}`),
  deletePdfReport: (reportId: number) =>
    request<void>(`/api/reports/pdf/${reportId}`, { method: "DELETE" }),

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

  // A student's own CV. The first read of an account that has never saved one answers
  // with an empty document rather than a 404, so the screen draws its form and no row
  // is written just because somebody opened the page.
  resume: () => request<Resume>("/api/resume"),
  // The whole document, because the server replaces rather than patches: a screen that
  // holds the entire CV on screen cannot half-save the list a student was editing.
  saveResume: (payload: ResumeInput) =>
    request<Resume>("/api/resume", { method: "POST", body: JSON.stringify(payload) }),
  /**
   * Skills and project ideas for one target role.
   *
   * The reply carries `provider` and `demo_generated`, and the screen has to show them:
   * when no AI provider is configured — or the one configured could not be reached —
   * these lists come from the career profiles inside this app, and calling that "AI
   * suggested" would be a claim this project does not get to make.
   */
  resumeSuggest: (target_role: string) =>
    request<ResumeSuggestion>("/api/ai/resume-suggest", {
      method: "POST",
      body: JSON.stringify({ target_role }),
    }),
  /**
   * One turn of a practice interview.
   *
   * The transcript travels with every request and nothing is stored server-side, which is
   * why this screen keeps it in memory: a practice interview holds whatever a student says
   * about themselves, and the answer to "where is it kept" is "on your device, until you
   * close the tab". `demo_generated` and `score` have to be read together by the screen —
   * when no model answered, there is no feedback and no number, and saying otherwise would
   * be a judgement about a child that nobody made.
   */
  mockInterview: (payload: { role: string; history: InterviewLine[]; language?: string }) =>
    request<InterviewTurn>("/api/ai/mock-interview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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

  /**
   * The study-abroad directory. Every one of these reads rows this repository has
   * curated, and the fields that were not looked up in an official source come back
   * null — the pages below print that as "not verified yet" instead of a number.
   */
  studyCountries: () => request<StudyCountryCard[]>("/api/study-abroad/countries"),
  studyCountry: (slug: string) =>
    request<StudyCountry>(`/api/study-abroad/countries/${encodeURIComponent(slug)}`),
  countryUniversities: (slug: string, search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<UniversitySummary[]>(
      `/api/study-abroad/countries/${encodeURIComponent(slug)}/universities${query}`,
    );
  },
  studyServices: () => request<StudyService[]>("/api/study-abroad/services"),
  studyService: (slug: string) =>
    request<StudyService>(`/api/study-abroad/services/${encodeURIComponent(slug)}`),
  /** Published stories only. The directory is empty until a named person agrees, so an
   * empty array is the expected answer and the page says so rather than inventing one. */
  studyStories: () => request<StudyStory[]>("/api/study-abroad/stories"),
  /**
   * An enquiry. The route answers with what it actually did — stored, mailed or not —
   * and a refusal arrives as 422 with the operator's sentence in `detail`, which
   * `request` turns into an `ApiError` message the form prints as it was written.
   */
  createStudyLead: (payload: StudyLeadIn) =>
    request<StudyLeadOut>("/api/study-abroad/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * The operator's screen behind these. Every route below answers 403 without the
   * `is_admin` flag, which only `scripts/admin_grant.py` sets — so `adminStudyMe` is
   * what lets the page say "this account is not the admin one" instead of showing an
   * empty table, and every call re-reads the flag on the server.
   */
  adminStudyMe: () => request<{ is_admin: boolean }>("/api/study-abroad/admin/me"),
  adminStudyLeads: (
    params: { status?: string; search?: string; limit?: number } = {},
  ) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
    ).toString();
    return request<StudyLeadAdmin[]>(`/api/study-abroad/admin/leads${query ? `?${query}` : ""}`);
  },
  /** Only the status and the operator's own note move; the enquiry itself is immutable. */
  handleStudyLead: (leadId: number, payload: StudyLeadHandle) =>
    request<StudyLeadAdmin>(`/api/study-abroad/admin/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteStudyLead: (leadId: number) =>
    request<void>(`/api/study-abroad/admin/leads/${leadId}`, { method: "DELETE" }),
  adminStudyUniversities: (
    params: {
      country?: string;
      unverified_only?: boolean;
      search?: string;
      include_inactive?: boolean;
      limit?: number;
    } = {},
  ) => {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => [k, String(v)]) as [string, string][],
    ).toString();
    return request<UniversityAdmin[]>(
      `/api/study-abroad/admin/universities${query ? `?${query}` : ""}`,
    );
  },
  /** Always lands unverified: a row cannot certify itself. */
  createStudyUniversity: (payload: UniversityCreate) =>
    request<UniversityAdmin>("/api/study-abroad/admin/universities", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateStudyUniversity: (slug: string, payload: UniversityUpdate) =>
    request<UniversityAdmin>(`/api/study-abroad/admin/universities/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminStudyStories: () => request<StudyStoryAdmin[]>("/api/study-abroad/admin/stories"),
  createStudyStory: (payload: StudyStoryInput) =>
    request<StudyStoryAdmin>("/api/study-abroad/admin/stories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /** The route replaces the whole story, so the body is the story as it should read. */
  updateStudyStory: (storyId: number, payload: StudyStoryInput) =>
    request<StudyStoryAdmin>(`/api/study-abroad/admin/stories/${storyId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteStudyStory: (storyId: number) =>
    request<void>(`/api/study-abroad/admin/stories/${storyId}`, { method: "DELETE" }),

  // ------------------------------------------------------------------------- operator
  /**
   * `/api/admin/*`, for the account holding the `is_admin` flag.
   *
   * Three things worth knowing before calling any of these from a new screen:
   *
   * * The flag is set by `python scripts/admin_grant.py --email <address>` on the
   *   server and by nothing else — no signup, no body, no route accepts it. A 403 is
   *   a normal answer here, and `app/app/admin/layout.tsx` shows it as one for the
   *   whole area rather than leaving each screen to invent its own refusal.
   * * A closed account gets a 401 even with the flag, because `get_current_user`
   *   checks `is_active` before the flag is ever read.
   * * These calls read counts and rows, never the inside of a conversation. There is
   *   no endpoint in this group that returns a transcript, an answer value, a device
   *   id or a come-back code, so a screen cannot be tempted to display one.
   */
  adminMe: () => request<{ is_admin: boolean }>("/api/admin/me"),
  adminSummary: () => request<AdminSummary>("/api/admin/summary"),
  adminUsers: (
    params: {
      q?: string;
      role?: string;
      state?: string;
      flag?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) => request<AdminUserPage>(`/api/admin/users${qs(params)}`),
  /** Granting is refused on a closed account; removing it is refused on your own. */
  adminSetOperator: (userId: number, isAdmin: boolean) =>
    request<AdminUserRow>(`/api/admin/users/${userId}/operator`, {
      method: "PATCH",
      body: JSON.stringify({ is_admin: isAdmin }),
    }),
  /** Closes or opens an account. It deletes nothing, and cannot be used on your own. */
  adminSetAccountStatus: (userId: number, isActive: boolean) =>
    request<AdminUserRow>(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }),
  adminCareers: (
    params: {
      q?: string;
      category?: string;
      to_verify?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) => request<AdminCareerPage>(`/api/admin/content/careers${qs(params)}`),
  /**
   * The row this route returns is the short one, so an editor first reads the whole
   * entry through the public `career` call below and sends back only the fields that
   * moved — an empty patch is refused, and `needs_verification` is refused in both
   * directions because a form has not read a source.
   */
  adminUpdateCareer: (slug: string, patch: AdminCareerPatch) =>
    request<AdminCareerRow>(`/api/admin/content/careers/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  adminQuestions: (
    params: { assessment_type?: string; dimension?: string; limit?: number; offset?: number } = {},
  ) => request<AdminQuestionPage>(`/api/admin/content/questions${qs(params)}`),
  /** Only an item with no answers stored against it may be reworded; the rest are 409. */
  adminUpdateQuestion: (questionId: number, patch: AdminQuestionPatch) =>
    request<AdminQuestionRow>(`/api/admin/content/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  adminBlog: () => request<AdminBlogStatus>("/api/admin/content/blog"),
  adminAudit: (
    params: {
      action?: string;
      actor?: number;
      since?: string;
      until?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) => request<AuditPage>(`/api/admin/audit${qs(params)}`),
  adminDeployment: () => request<AdminDeployment>("/api/admin/deployment"),

  /**
   * The operator's side of the exam catalogue. Same guard as the rest: 403 without the
   * `is_admin` flag, and `/api/exams/admin` answers 429 with the throttle's own sentence
   * once ten writes have gone by in a minute.
   *
   * Two shapes here are deliberate, and both are the server's rules rather than this
   * client's preference. `adminCreateExam` takes a body with no date, no fee and no
   * `verified` — a new row is a name, a conducting body and four sentences. And
   * `adminPatchExam` refuses on the server anything that would put a figure on a card
   * without the page it was read from, so a `Notice` here can print the refusal instead of
   * grey-ing out a control the operator is entitled to press.
   */
  adminExams: () => request<ExamGroupAdminRow[]>("/api/exams/admin"),
  adminCreateExamGroup: (body: ExamGroupCreateInput) =>
    request<ExamGroupAdminRow>("/api/exams/admin/groups", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** `is_active: false` is how a door leaves the page without deleting the cards under it. */
  adminPatchExamGroup: (groupId: number, body: ExamGroupUpdateInput) =>
    request<ExamGroupAdminRow>(`/api/exams/admin/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  /** Refused with 422 while any exam still stands under the door. */
  adminDeleteExamGroup: (groupId: number) =>
    request<void>(`/api/exams/admin/groups/${groupId}`, { method: "DELETE" }),
  adminCreateExam: (body: ExamCreateInput) =>
    request<ExamAdminRow>("/api/exams/admin/exams", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminPatchExam: (examId: number, body: ExamUpdateInput) =>
    request<ExamAdminRow>(`/api/exams/admin/exams/${examId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminDeleteExam: (examId: number) =>
    request<void>(`/api/exams/admin/exams/${examId}`, { method: "DELETE" }),

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

  /**
   * Payments. No method here ever sends a price, a plan period or a user id: the order
   * is priced by the server from the plan code, and `verifyPayment` returns whatever that
   * stored order says. `pricing` is public and needs no session, which is why a family can
   * read the terms before deciding whether to sign in at all.
   */
  pricing: () => request<Pricing>("/api/payments/plans"),
  billing: () => request<Billing>("/api/payments/me"),
  createOrder: (planCode: string, adultAttested: boolean) =>
    request<PaymentOrder>("/api/payments/create-order", {
      method: "POST",
      body: JSON.stringify({ plan_code: planCode, adult_attested: adultAttested }),
    }),
  verifyPayment: (confirmation: PaymentConfirmation) =>
    request<Payment>("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify(confirmation),
    }),
  downgradePlan: () =>
    request<PlanDetail>("/api/payments/downgrade", {
      method: "POST",
      body: JSON.stringify({ confirm_gives_up_remaining: true }),
    }),

  /**
   * School and counsellor portals. No method here passes a user id: which portal a
   * request speaks for is in the path, and what the caller may see inside it is decided
   * by the bearer token — so a roster, a client list or a note cannot be aimed at
   * another school by editing a body.
   */
  orgMine: () => request<MyMembership[]>("/api/organizations/mine"),
  orgTiers: (kind?: OrgKind) =>
    request<Tier[]>(`/api/organizations/tiers${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`),
  /** A portal's look, readable with no session at all — the join page paints itself from it. */
  orgPortal: (slug: string) =>
    request<PortalBranding>(
      `/api/organizations/portal?slug=${encodeURIComponent(slug)}`,
    ),
  orgCreate: (payload: { name: string; slug?: string | null }) =>
    request<Organization>("/api/organizations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  orgSummary: () => request<PortalSummary[]>("/api/organizations/summary"),
  orgRead: (slug: string) => request<PortalSummary>(`/api/organizations/${encodeURIComponent(slug)}`),
  orgRename: (slug: string, name: string) =>
    request<Organization>(`/api/organizations/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  orgBranding: (slug: string) =>
    request<Branding>(`/api/organizations/${encodeURIComponent(slug)}/branding`),
  saveBranding: (slug: string, patch: BrandingInput) =>
    request<Branding>(`/api/organizations/${encodeURIComponent(slug)}/branding`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  orgMembers: (slug: string) =>
    request<MemberAdminRow[]>(`/api/organizations/${encodeURIComponent(slug)}/members`),
  orgClients: (slug: string) =>
    request<MemberRow[]>(`/api/organizations/${encodeURIComponent(slug)}/clients`),
  invite: (slug: string, payload: InviteInput) =>
    request<InviteResult>(`/api/organizations/${encodeURIComponent(slug)}/invites`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  inviteBulk: (slug: string, members: InviteInput[]) =>
    request<InviteResult>(`/api/organizations/${encodeURIComponent(slug)}/invites/bulk`, {
      method: "POST",
      body: JSON.stringify({ members }),
    }),
  acceptInvite: (payload: AcceptInput) =>
    request<AcceptResult>("/api/organizations/join", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setSharing: (slug: string, share_results: boolean) =>
    request<MemberRow>(`/api/organizations/${encodeURIComponent(slug)}/me`, {
      method: "PATCH",
      body: JSON.stringify({ share_results }),
    }),
  leavePortal: (slug: string) =>
    request<MyMembership>(`/api/organizations/${encodeURIComponent(slug)}/me`, {
      method: "DELETE",
    }),
  assignCounsellor: (slug: string, memberId: number, counsellor_membership_id: number | null) =>
    request<MemberRow>(
      `/api/organizations/${encodeURIComponent(slug)}/members/${memberId}/counsellor`,
      { method: "POST", body: JSON.stringify({ counsellor_membership_id }) },
    ),
  removeMember: (slug: string, memberId: number) =>
    request<MemberRow>(`/api/organizations/${encodeURIComponent(slug)}/members/${memberId}`, {
      method: "DELETE",
    }),
  notes: (slug: string, clientMembershipId?: number) =>
    request<SessionNote[]>(
      `/api/organizations/${encodeURIComponent(slug)}/notes${
        clientMembershipId != null ? `?client_membership_id=${clientMembershipId}` : ""
      }`,
    ),
  writeNote: (slug: string, payload: { client_membership_id: number; body: string }) =>
    request<SessionNote>(`/api/organizations/${encodeURIComponent(slug)}/notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  shareNote: (slug: string, noteId: number, shared_with_family: boolean) =>
    request<SessionNote>(
      `/api/organizations/${encodeURIComponent(slug)}/notes/${noteId}/share`,
      { method: "PATCH", body: JSON.stringify({ shared_with_family }) },
    ),
  deleteNote: (slug: string, noteId: number) =>
    request<SessionNote>(`/api/organizations/${encodeURIComponent(slug)}/notes/${noteId}`, {
      method: "DELETE",
    }),
  /** Notes about this account that somebody chose to send. Only the sent ones. */
  myNotes: (slug: string) =>
    request<SessionNote[]>(`/api/organizations/${encodeURIComponent(slug)}/my-notes`),
  analytics: (slug: string) =>
    request<PortalAnalytics>(`/api/organizations/${encodeURIComponent(slug)}/analytics`),
};
