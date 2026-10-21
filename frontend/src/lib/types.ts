/** Mirrors the FastAPI response models in backend/app/schemas.py. */

export type Role = "student" | "parent";
export type Language = "en" | "hi" | "hinglish";
export type AgeBand = "3-5" | "6-8" | "9-10" | "11-12" | "adult";
export type EvidenceLevel = "early" | "some" | "good";
export type PlanItemStatus = "pending" | "in_progress" | "completed" | "skipped";

export type ThemeKey =
  | "creative_exploration"
  | "analytical_problem_solving"
  | "practical_building"
  | "communication_collaboration"
  | "helping_others"
  | "physical_activity_sports"
  | "nature_scientific_curiosity"
  | "organization_leadership";

export const CAREER_CATEGORIES = [
  "Science and Healthcare",
  "Engineering and Technology",
  "AI and Data",
  "Sports and Fitness",
  "Aviation",
  "Defence and Public Services",
  "Art, Design, and Media",
  "Business and Entrepreneurship",
  "Finance and Banking",
  "Law and Social Sciences",
  "Education and Research",
  "Environment and Agriculture",
  "Skilled Trades and Vocational Careers",
  "Hospitality and Tourism",
  "Other emerging careers",
] as const;

export type CareerCategory = (typeof CAREER_CATEGORIES)[number];

export const THEME_LABELS: Record<ThemeKey, string> = {
  creative_exploration: "Creative exploration",
  analytical_problem_solving: "Analytical problem-solving",
  practical_building: "Practical building and making",
  communication_collaboration: "Communication and collaboration",
  helping_others: "Helping and supporting others",
  physical_activity_sports: "Physical activity and sports",
  nature_scientific_curiosity: "Nature and scientific curiosity",
  organization_leadership: "Organization and leadership",
};

export const LANGUAGE_OPTIONS = [
  { value: "hinglish", label: "Hinglish (Hindi + English)" },
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
] as const;

export const AGE_BANDS: { value: AgeBand; label: string; note: string }[] = [
  { value: "3-5", label: "Age 3 to 5", note: "Very simple questions about play and colours" },
  { value: "6-8", label: "Age 6 to 8", note: "Short conversations about what they enjoy" },
  { value: "9-10", label: "Age 9 to 10", note: "Careers explained through daily work" },
  { value: "11-12", label: "Age 11 to 12", note: "Streams, subjects and skill ideas" },
  { value: "adult", label: "Age 13 or above", note: "Full guidance, including costs and entrances" },
];

export const INTEREST_OPTIONS = [
  "Drawing and painting",
  "Stories and writing",
  "Music or dance",
  "Maths and puzzles",
  "Science experiments",
  "Computers and coding",
  "Building and fixing things",
  "Sports and games",
  "Helping people",
  "Teaching others",
  "Nature and animals",
  "Plants and farming",
  "Speaking in front of people",
  "Organising events",
  "Business and money",
  "Movies, photos and videos",
  "Designing how things look",
  "Maps, travel and places",
  "Cooking and food",
  "Machines and vehicles",
  "History and society",
  "New technologies",
];

// Classes 6 to 12. The server accepts nothing outside this list, so a value that is
// not here cannot be saved even by a request built by hand.
export const CLASS_OPTIONS = [
  { value: "class-6", label: "Class 6" },
  { value: "class-7", label: "Class 7" },
  { value: "class-8", label: "Class 8" },
  { value: "class-9", label: "Class 9" },
  { value: "class-10", label: "Class 10" },
  { value: "class-11", label: "Class 11" },
  { value: "class-12", label: "Class 12" },
] as const;

export interface User {
  id: number;
  role: Role;
  display_name: string;
  preferred_language: string;
}

export interface StudentProfile {
  class_level: string | null;
  /** The age in years, typed by the person it is about. `age_range` below is derived from
   * it by the server, so a profile that has never stated a number keeps only the band. */
  age: number | null;
  age_range: string | null;
  interest_areas: string[];
  education_context: string | null;
  financial_context: string | null;
}

export interface Settings {
  language: string;
  voice: string | null;
  speak_responses: boolean;
  continuous_conversation: boolean;
  save_history: boolean;
  reduced_motion: boolean;
  high_contrast: boolean;
}

export interface Session {
  token: string;
  user: User;
  profile: StudentProfile | null;
  settings: Settings;
}

/** The answer to "has this device been here before?". `known: false` is a normal
 * reply, not an error: a new device simply goes to the one opening question. */
export interface GuestResult {
  known: boolean;
  session: Session | null;
}

/**
 * The answer to "may this session carry on?".
 *
 * `extended` is the only interesting field: a session has a ceiling set when the
 * sign-in happened, and once it is reached every later refresh answers false and changes
 * nothing. A screen that treats false as success would keep a credential alive that the
 * server has already decided must end.
 */
export interface SessionRenewal {
  expires_at: string;
  extended: boolean;
  session_started_at: string | null;
}

/**
 * The optional email sign-in, for *this* account.
 *
 * `linked` is whether an email can open this account from another device.
 * `available` is whether this deployment offers that at all — the two are different
 * questions, and a screen must not tell a family to go looking for a button the site
 * has never switched on. `note` is the sentence to show beside the switch: the
 * backend owns that wording so the promise made to a child about their data cannot
 * drift between screens.
 */
export interface ClerkStatus {
  linked: boolean;
  linked_at: string | null;
  available: boolean;
  note: string;
}

export interface OnboardingPayload {
  role: Role;
  display_name: string;
  preferred_language: Language;
  device_id?: string;
  class_level?: string | null;
  age_range?: string | null;
  interest_areas?: string[];
  relationship?: string | null;
  student_name?: string | null;
  student_class_level?: string | null;
  education_context?: string | null;
  financial_context?: string | null;
  consent_profile: boolean;
  consent_voice: boolean;
  consent_age: "3-5" | "6-8" | "9-10" | "11-12" | "adult";
}

export interface CareerSummary {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  interest_themes: ThemeKey[];
  min_class: number;
}

export interface OfficialLink {
  label: string;
  url: string;
  note?: string;
}

export interface Career extends CareerSummary {
  typical_activities: string[];
  useful_skills: string[];
  school_subjects: string[];
  education_pathways: string[];
  entry_requirements: string[];
  preparation_stages: string[];
  typical_day: string | null;
  costs_and_alternatives: string | null;
  benefits: string[];
  challenges: string[];
  explore_activities: string[];
  official_links: OfficialLink[];
  related_slugs: string[];
  needs_verification: boolean;
}

export interface Category {
  name: string;
  count: number;
}

export interface SavedCareer {
  career: CareerSummary;
  saved_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  demo_generated: boolean;
  created_at: string;
}

export interface ConversationInfo {
  id: number;
  kind: "chat" | "voice";
  language: string;
  stage: number;
  status: string;
  created_at: string;
  /** Sent by the server only when a conversation is first opened. */
  greeting?: string | null;
}

export interface ChatReply {
  reply: ChatMessage;
  stage: number;
  audio_url: string | null;
  audio_error: string | null;
  detected_themes: string[];
  provider: string;
  /** The language the guide answered in — it follows the student, not the account. */
  language: string;
  /** Profile facts this turn taught the app, already saved to the student's profile. */
  profile_updates?: Record<string, unknown>;
  /** The guide judged this message as a child possibly asking for help. */
  needs_support: boolean;
}

export interface InterestPrompt {
  id: string;
  question: string;
  hint: string;
}

export interface ThemeSummary {
  theme: ThemeKey;
  label: string;
  blurb: string;
  evidence: string[];
  suggested_categories: string[];
}

export interface InterestSummary {
  themes: ThemeSummary[];
  note: string;
}

export interface Observation {
  id: number;
  theme: ThemeKey;
  evidence: string;
  source: string;
  created_at: string;
}

export interface Recommendation {
  career: CareerSummary;
  why: string;
  supporting_statements: string[];
  open_questions: string[];
  skills_to_try: string[];
  qualifications_to_check: string[];
  alternatives: string[];
  evidence_level: EvidenceLevel;
  next_activity: string | null;
}

export interface RecommendationSet {
  recommendations: Recommendation[];
  note: string;
  themes: ThemeKey[];
  named_ambitions: string[];
  statement_count: number;
}

export interface JourneyEvent {
  id: number;
  kind: string;
  title: string;
  detail: string | null;
  created_at: string;
}

export interface Journey {
  events: JourneyEvent[];
  sessions_completed: number;
  careers_saved: number;
  themes_explored: number;
  plans_active: number;
  activities_completed: number;
  activities_total: number;
}

export interface PlanItem {
  id: number;
  title: string;
  detail: string | null;
  estimated_effort: string | null;
  resource_url: string | null;
  status: PlanItemStatus;
  order: number;
}

export interface StudyPlan {
  id: number;
  title: string;
  goal: string;
  career_id: number | null;
  status: string;
  created_at: string;
  items: PlanItem[];
}

export interface Resource {
  id: number;
  title: string;
  kind: string;
  category: string;
  level: string;
  language: string;
  description: string;
  url: string;
  verified: boolean;
  duration_minutes: number | null;
}

export interface Scholarship {
  id: number;
  name: string;
  provider: string;
  scope: string;
  education_levels: string[];
  states: string[];
  categories: string[];
  benefit_summary: string;
  eligibility_summary: string;
  application_steps: string[];
  official_url: string;
  verified: boolean;
  last_verified_at: string | null;
  disclaimer: string;
}

export interface Institution {
  id: number;
  name: string;
  city: string;
  state: string;
  institution_type: string;
  mode: string;
  education_level: string;
  career_areas: string[];
  courses: string[];
  fee_range: string | null;
  admission_info: string | null;
  scholarships_note: string | null;
  website: string;
  verified: boolean;
  last_verified_at: string | null;
  sponsored: boolean;
  sponsorship_disclosure: string | null;
}

export interface CareerReport {
  id: number;
  generated_at: string;
  content: ReportContent;
}

export interface ReportRecommendation {
  career_id: number;
  career: string;
  category: string;
  why: string;
  supporting_statements: string[];
  open_questions: string[];
  skills_to_try: string[];
  qualifications_to_check: string[];
  alternatives: string[];
  evidence_level: EvidenceLevel;
  evidence_note: string;
  next_activity: string | null;
}

export interface ReportContent {
  student: { name: string; class_level: string | null; language: string };
  framing: string;
  note: string;
  themes_observed: {
    theme: ThemeKey;
    label: string;
    blurb: string;
    evidence: string[];
  }[];
  activities_enjoyed: string[];
  named_ambitions: string[];
  recommendations: ReportRecommendation[];
  saved_careers: { id: number; title: string; category: string }[];
  suggested_experiments: string[];
  next_steps: string[];
  financial_resources_to_verify: string;
  unanswered_questions: string[];
  sessions_reviewed: number;
}

export interface ParentChild {
  student_id: number;
  label: string;
  class_level: string | null;
}

export interface ParentSummary {
  student: User;
  profile: StudentProfile | null;
  themes: Observation[];
  recommendations: Recommendation[];
  saved_careers: SavedCareer[];
  journey: Journey;
  latest_report: CareerReport | null;
  share_transcripts: boolean;
  recent_sessions: ConversationInfo[];
  guidance_note: string;
}

export interface ParentGuidance {
  concern: string;
  acknowledgement: string;
  evidence: string;
  what_remains_unclear: string[];
  routes_and_costs: string;
  alternatives: string[];
  low_risk_tests: string[];
  discussion_prompt: string;
  seek_help_from: string;
}

export interface VoiceOption {
  language: string;
  voices: { id: string; label: string }[];
}

export interface VoiceInfo {
  voices: VoiceOption[];
  provider: string;
  note: string;
}

export interface ConsentRecord {
  scope: string;
  granted: boolean;
  version: string;
  created_at: string;
}

/** What the last real synthesis on the server did. `ok: null` means nobody has
 * asked it for audio since that server started, which is not the same as working. */
export interface VoiceAttempt {
  checked_at: string | null;
  ok: boolean | null;
  provider: string | null;
  reason: string | null;
}

export interface Health {
  status: string;
  storage: string;
  ai_provider: string;
  ai_configured: boolean;
  tts_provider: string;
  tts_ready: boolean;
  tts_last_attempt: VoiceAttempt;
  demo_mode: boolean;
}

export interface ShareCode {
  code: string | null;
  note: string;
}

export interface GuardianLink {
  guardianship_id: number;
  name: string;
  relationship: string | null;
  can_see_summary: boolean;
  can_see_transcripts: boolean;
  linked_at: string;
}

/**
 * Payments. Prices travel as paise (₹1 = 100 paise) because a float is the wrong tool
 * for money a parent has to trust on an invoice — see `lib/money.ts` for formatting.
 * No response here contains an amount the browser may send back: an order is priced by
 * the server, from the plan code, and verification compares against that stored order.
 */
export interface PricingPlan {
  code: string;
  name: string;
  tagline: string;
  price_paise: number | null;
  compare_at_paise: number | null;
  savings_paise: number;
  savings_percent: number;
  interval: string;
  period_days: number | null;
  cta: string;
  purchasable: boolean;
  currency: string;
  daily_chats: number | null;
  total_assessments: number | null;
  pdf_reports: boolean;
  parent_dashboard: boolean;
  /** One entry per `FeatureRow.key`: a bool for included/not, or the plan's own wording. */
  features: Record<string, boolean | string>;
}

export interface FeatureRow {
  key: string;
  label: string;
  help: string;
}

export interface Pricing {
  plans: PricingPlan[];
  features: FeatureRow[];
  currency: string;
  /** False until keys are configured on the server. The buttons read this. */
  payments_enabled: boolean;
  test_mode: boolean;
  /** Whether this deployment actually caps the free plan today. */
  limits_enforced: boolean;
}

/** Everything the browser hands to Razorpay's Checkout, from the server's order. */
export interface CheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  theme?: Record<string, string>;
}

export interface PaymentOrder {
  order_id: string;
  amount_paise: number;
  currency: string;
  plan_code: string;
  plan_name: string;
  receipt: string;
  checkout: CheckoutOptions;
}

/** The three values Checkout returns and the server verifies by HMAC. */
export interface PaymentConfirmation {
  order_id: string;
  payment_id: string;
  razorpay_signature: string;
}

export interface Payment {
  id: number;
  order_id: string;
  payment_id: string | null;
  plan_code: string;
  interval: string;
  amount_paise: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  receipt: string;
  captured_at: string | null;
  created_at: string;
  test_mode: boolean;
}

export interface PlanUsage {
  plan_code: string;
  /** null means the plan is not capped, which the screen prints as "Unlimited". */
  chats_today: number | null;
  chats_allowed: number | null;
  chats_left: number | null;
  assessments_done: number;
  assessments_allowed: number | null;
  enforced: boolean;
}

export interface PlanDetail {
  plan_code: string;
  plan_name: string;
  /** payment | granted | free — a `granted` plan is a licence, not a claim that money moved. */
  source: string;
  interval: string | null;
  started_at: string | null;
  expires_at: string | null;
  active: boolean;
  lapsed_plan: string | null;
  shared_from_family: boolean;
  daily_chats: number | null;
  total_assessments: number | null;
  pdf_reports: boolean;
  parent_dashboard: boolean;
}

export interface Billing {
  plan: PlanDetail;
  usage: PlanUsage;
  payments: Payment[];
  payments_enabled: boolean;
  test_mode: boolean;
  /** The publishable key, or null when payments are switched off. */
  key_id: string | null;
}

/**
 * Study abroad. These mirror `schemas.py`'s study-abroad block field for field, and
 * the `null` in it is load-bearing: a university's tuition, intakes and deadlines are
 * NULL because nobody has read them off an official page yet, and every screen below
 * prints that fact rather than a remembered number.
 */

/** Where a family is at, in six words a student would not be embarrassed by. */
export type LeadStage = "class-9" | "class-10" | "class-11" | "class-12" | "in-college" | "other";

export interface StudyCountry {
  slug: string;
  name: string;
  code: string;
  overview: string;
  language_note: string | null;
  intake_note: string | null;
  cost_note: string | null;
  work_after_note: string | null;
  to_check: string[];
  visa_portal_url: string | null;
  visa_portal_label: string | null;
  qualifications_portal_url: string | null;
  qualifications_portal_label: string | null;
  /** null means this copy has not been re-read against the official portal. */
  checked_at: string | null;
  sort_order: number;
}

export interface StudyCountryCard extends StudyCountry {
  universities: number;
}

/** The list row: enough to choose where to look, too little to quote anywhere. */
export interface UniversitySummary {
  slug: string;
  name: string;
  city: string;
  kind: string;
  official_url: string;
  verified: boolean;
  sponsored: boolean;
}

export interface University extends UniversitySummary {
  id: number;
  founded_year: number | null;
  summary: string | null;
  areas: string[];
  tuition_note: string | null;
  intakes: string[];
  application_urls: Record<string, string>;
  english_test_note: string | null;
  deadline_note: string | null;
  source_url: string | null;
  verified_at: string | null;
  sponsorship_disclosure: string | null;
  sort_order: number;
}

export interface StudyService {
  slug: string;
  title: string;
  summary: string;
  detail: string | null;
  steps: string[];
  includes: string[];
  not_included: string[];
  who_for: string | null;
  fees_note: string | null;
  /** false is described on the page as not being offered yet. No button on that page
   * pretends otherwise, which is the whole reason this is a field and not a route. */
  available: boolean;
  sort_order: number;
}

export interface StudyStory {
  id: number;
  headline: string;
  body: string;
  attribution: string;
  year: number | null;
  published_at: string | null;
}

export interface StudyLeadIn {
  name: string;
  email: string;
  phone?: string | null;
  stage?: LeadStage | null;
  country_slug?: string | null;
  service_slug?: string | null;
  message?: string | null;
  source_page?: string | null;
  consent_contact: boolean;
  /** The honeypot. Rendered `hidden`, never a label a person can reach. */
  company?: string;
}

/** What happened to an enquiry. `stored` is the only promise the route makes alone;
 * `reason` and `note` say in words whether an acknowledgement went out. */
export interface StudyLeadOut {
  stored: boolean;
  reason: string;
  note: string;
  notified_operator: boolean;
}

/**
 * The operator's half of the study-abroad directory. Nothing here is reachable without
 * the `is_admin` flag on the account this browser's token belongs to, which is why an
 * `ApiError` with status 403 is a normal answer on this screen rather than a bug.
 */

export interface StudyLeadAdmin {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  stage: string | null;
  country_id: number | null;
  service_id: number | null;
  message: string | null;
  source_page: string | null;
  consent_contact: boolean;
  consent_contact_at: string | null;
  status: string;
  admin_note: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface StudyLeadHandle {
  status: "new" | "contacted" | "closed";
  admin_note?: string | null;
}

export interface UniversityAdmin extends University {
  country_id: number;
  country_slug: string;
  is_active: boolean;
  created_at: string;
}

export interface UniversityCreate {
  name: string;
  country_slug: string;
  city: string;
  kind: "public" | "private";
  official_url: string;
  summary?: string | null;
  areas?: string[];
}

/** Absent means unchanged; an empty string or null clears a field. `verified: true` is
 * refused by the server unless a `source_url` is on the row or travels with this body. */
export type UniversityUpdate = Partial<Omit<UniversityCreate, "name" | "country_slug">> & {
  founded_year?: number | null;
  summary?: string | null;
  areas?: string[] | null;
  tuition_note?: string | null;
  intakes?: string[] | null;
  application_urls?: Record<string, string> | null;
  english_test_note?: string | null;
  deadline_note?: string | null;
  source_url?: string | null;
  verified?: boolean | null;
  sponsored?: boolean | null;
  sponsorship_disclosure?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

export interface StudyStoryAdmin extends StudyStory {
  country_id: number | null;
  university_id: number | null;
  /** Read back as slugs because the write routes take them as slugs. An edit that did
   * not send the current value would replace the row and lose the link. */
  country_slug: string | null;
  university_slug: string | null;
  consent_confirmed_at: string | null;
  published: boolean;
}

/** Both the create body and the replace body: the PATCH route takes the whole story. */
export interface StudyStoryInput {
  headline: string;
  body: string;
  attribution: string;
  country_slug?: string | null;
  university_slug?: string | null;
  year?: number | null;
  consent_confirmed_at?: string | null;
  published?: boolean;
}

/**
 * The exam catalogue — `backend/app/routers/exams.py`. A card is a door (`ExamGroup`) and
 * the exams standing under it.
 *
 * `exam_date` and `fee_note` are nullable on purpose and the API withholds both from any
 * row nobody has read off a source. A `null` there is not missing data to fill in with a
 * guess; it is the page saying, in the sentence it has always printed, that this year's
 * official notification is the authority.
 */
export interface ExamCard {
  id: number;
  group_id: number;
  name: string;
  /** Whose exam it is, printed as stored ("Conducted by NTA"). */
  authority: string;
  description: string;
  careers: string;
  timeline: string;
  preparation: string;
  exam_date: string | null;
  fee_note: string | null;
  source_url: string | null;
  verified: boolean;
  verified_at: string | null;
}

export interface ExamGroupCard {
  id: number;
  title: string;
  description: string;
  exams: ExamCard[];
}

export interface ExamAdminRow extends ExamCard {
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ExamGroupAdminRow extends Omit<ExamGroupCard, "exams"> {
  is_active: boolean;
  sort_order: number;
  exams: ExamAdminRow[];
}

/** The create body. There is no `exam_date`, no `fee_note` and no `verified` here: a new
 * row is a name, a conducting body and four sentences, and a figure can only enter later,
 * through the update route, which makes the row name the page it came from. */
export interface ExamCreateInput {
  group_id: number;
  name: string;
  authority: string;
  description: string;
  careers: string;
  timeline: string;
  preparation: string;
  sort_order?: number | null;
}

/** Absent means unchanged, empty clears. `verified: true` is refused unless a `source_url`
 * is on the row or travels with this body, and `verified_at` is stamped by the server. */
export interface ExamUpdateInput {
  name?: string | null;
  authority?: string | null;
  description?: string | null;
  careers?: string | null;
  timeline?: string | null;
  preparation?: string | null;
  exam_date?: string | null;
  fee_note?: string | null;
  source_url?: string | null;
  verified?: boolean | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

export interface ExamGroupCreateInput {
  title: string;
  description: string;
  sort_order?: number | null;
}

export interface ExamGroupUpdateInput {
  title?: string | null;
  description?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

/**
 * What an erasure did, from `DELETE /api/users/me`.
 *
 * `removed` is per table, because "we deleted your data" is not checkable and "14 messages,
 * 1 report" is. `kept` is the harder half and is on purpose: the money ledger and the
 * operator log survive, so a confirmation dialog that said only "everything goes" would be
 * the app lying about what it did.
 */
export interface ErasureOut {
  erased_at: string;
  removed: Record<string, number>;
  kept: string[];
  message: string;
}

/**
 * Tenancy. These mirror `backend/app/schemas.py` field for field, including the two
 * things the mirrors are easy to get wrong: `invited_email` only ever comes back to the
 * staff who typed it, and a datetime arrives as a string over JSON.
 */
export type OrgKind = "school" | "counsellor";
export type MemberRole = "student" | "parent" | "counsellor" | "school_admin";
export type MemberStatus = "invited" | "active" | "revoked";

export interface Organization {
  slug: string;
  kind: OrgKind;
  name: string;
  tier_code: string;
  verified: boolean;
  is_active: boolean;
}

/** What a portal shows before anybody proves who they are. No count of anything. */
export interface PortalBranding {
  slug: string;
  kind: OrgKind;
  name: string;
  verified: boolean;
  portal_title: string | null;
  logo_url: string | null;
  accent_color: string | null;
}

export interface Branding {
  portal_title: string | null;
  welcome_note: string | null;
  logo_url: string | null;
  accent_color: string | null;
  changed_at: string;
}

/** The PUT route writes only the keys present, so a caller sends what it edited. */
export type BrandingInput = Partial<Omit<Branding, "changed_at">>;

export interface MemberRow {
  id: number;
  org_role: MemberRole;
  status: MemberStatus;
  display_label: string | null;
  joined_at: string | null;
  /** The member's own answer, read-only on every screen but this row's owner's. */
  share_results: boolean;
  assigned_counsellor_label: string | null;
}

export interface MemberAdminRow extends MemberRow {
  invited_email: string | null;
  invite_expires_at: string | null;
}

export interface InviteInput {
  email: string;
  org_role: MemberRole;
  display_label?: string | null;
}

export interface InviteResult {
  invited: string[];
  already_there: string[];
  refused: string[];
  seats_left: number;
  mailed: boolean;
  mail_detail: string | null;
}

export interface AcceptInput {
  token: string;
  share_results: boolean;
}

export interface AcceptResult {
  slug: string;
  kind: OrgKind;
  name: string;
  org_role: MemberRole;
  portal_title: string | null;
  share_results: boolean;
}

export interface MyMembership {
  slug: string;
  kind: OrgKind;
  name: string;
  org_role: MemberRole;
  status: MemberStatus;
  portal_title: string | null;
  /** The caller's own switch, sent here because the roster that carries it is a staff view. */
  share_results: boolean;
}

export interface PortalSummary {
  organization: Organization;
  seats: number;
  seats_used: number;
  seats_left: number;
  joined: number;
  invited: number;
  staff: number;
}

export interface Tier {
  code: string;
  name: string;
  kind: string;
  tagline: string;
  seats: number;
  price_rupees: number | null;
  includes: string[];
  not_included: string[];
  /** false for every tier in this build, and read so the screen can say so out loud. */
  purchasable: boolean;
}

export interface AnalyticsBucket {
  label: string;
  count: number;
}

export interface PortalAnalytics {
  cohort_size: number;
  sittings_started: number;
  sittings_completed: number;
  shared_results: number;
  by_stage: AnalyticsBucket[];
  by_language: AnalyticsBucket[];
  /** The breakdowns withheld because the cohort is too small to hide inside. */
  hidden: string[];
  min_reportable: number;
}

export interface SessionNote {
  id: number;
  client_membership_id: number;
  body: string;
  shared_with_family: boolean;
  shared_at: string | null;
  created_at: string;
  edited_at: string | null;
  author_label: string | null;
}

// --------------------------------------------------------------------------- admin
// Mirrors `app/schemas.py::Admin*`. Dates are ISO strings here because the operator
// screens format them by hand; nothing on this side of the wire does arithmetic on one.

export interface AdminBucket {
  label: string;
  count: number;
}

export interface AdminUserMetrics {
  total: number;
  students: number;
  parents: number;
  closed: number;
  operators: number;
  new_7d: number;
  new_30d: number;
}

export interface AdminChatMetrics {
  sessions: number;
  chat_sessions: number;
  voice_sessions: number;
  messages: number;
  sessions_7d: number;
  messages_7d: number;
  /** Replies written by the canned demo model, kept apart from a configured provider's. */
  demo_replies: number;
  real_replies: number;
}

export interface AdminAssessmentMetrics {
  started: number;
  completed: number;
  in_progress: number;
  results: number;
  completed_7d: number;
  pdf_reports: number;
  by_type: AdminBucket[];
}

export interface AdminRevenueMetrics {
  captured_paise: number;
  captured_paise_30d: number;
  captured_orders: number;
  failed_orders: number;
  refunded_paise: number;
  /** Test-key payments, never added to `captured_paise`: they moved no money. */
  test_paise: number;
  test_orders: number;
  paying_accounts: number;
  granted_accounts: number;
  by_plan: AdminBucket[];
}

export interface AdminPortalMetrics {
  organizations: number;
  schools: number;
  practices: number;
  members_active: number;
  members_invited: number;
  notes_shared: number;
}

export interface AdminContentMetrics {
  careers: number;
  careers_to_verify: number;
  questions: number;
  leads_open: number;
  leads_total: number;
  email_queued: number;
  email_failed: number;
}

export interface AdminSummary {
  generated_at: string;
  users: AdminUserMetrics;
  chats: AdminChatMetrics;
  assessments: AdminAssessmentMetrics;
  revenue: AdminRevenueMetrics;
  portals: AdminPortalMetrics;
  content: AdminContentMetrics;
}

/**
 * One account and its own usage counts. There is deliberately no field for a
 * transcript, an answer value, a device id or a come-back code: the row is what
 * `AdminUserRowOut` sends, and the server has no way to send the rest.
 */
export interface AdminUserRow {
  id: number;
  role: Role;
  display_name: string;
  preferred_language: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  contact_email: string | null;
  email_confirmed_at: string | null;
  plan_code: string;
  plan_expires_at: string | null;
  conversations: number;
  assessments: number;
  assessments_completed: number;
  portal_memberships: number;
}

export interface AdminUserPage {
  total: number;
  limit: number;
  offset: number;
  items: AdminUserRow[];
}

export interface AdminCareerRow {
  slug: string;
  title: string;
  category: string;
  summary: string;
  min_class: number;
  needs_verification: boolean;
  created_at: string;
}

export interface AdminCareerPage {
  total: number;
  limit: number;
  offset: number;
  items: AdminCareerRow[];
}

/** A patch: `undefined` means leave the field alone, and an empty patch is refused. */
export interface AdminCareerPatch {
  title?: string;
  category?: string;
  summary?: string;
  typical_activities?: string[];
  useful_skills?: string[];
  school_subjects?: string[];
  education_pathways?: string[];
  entry_requirements?: string[];
  preparation_stages?: string[];
  typical_day?: string;
  costs_and_alternatives?: string;
  benefits?: string[];
  challenges?: string[];
  explore_activities?: string[];
  related_slugs?: string[];
  interest_themes?: string[];
  min_class?: number;
}

export interface AdminQuestionRow {
  id: number;
  assessment_type: string;
  code: string;
  dimension: string;
  order: number;
  response_type: string;
  keyed: string;
  text_en: string;
  text_hi: string;
  options: { value?: string; label?: { en?: string; hi?: string } }[];
  correct_value: string | null;
  /** Answers already stored against this code — the evidence behind `editable`. */
  answers: number;
  editable: boolean;
}

export interface AdminQuestionPage {
  total: number;
  limit: number;
  offset: number;
  items: AdminQuestionRow[];
}

export interface AdminQuestionPatch {
  text_en?: string;
  text_hi?: string;
  dimension?: string;
  keyed?: "+" | "-";
  response_type?: string;
  correct_value?: string;
  order?: number;
}

export interface AuditEventRow {
  id: number;
  created_at: string;
  action: string;
  actor_user_id: number | null;
  actor_name: string | null;
  subject_type: string | null;
  subject_id: string | null;
  detail: string | null;
  /** `script` means the change came from a shell through `admin_grant.py`, not a page. */
  origin: string;
}

export interface AuditPage {
  total: number;
  limit: number;
  offset: number;
  items: AuditEventRow[];
  /** Every action name in the table, so the filter lists what has actually happened. */
  actions: string[];
}

export interface AdminDeployment {
  app_name: string;
  ai_provider: string;
  ai_model: string;
  ai_configured: boolean;
  tts_provider: string;
  gemini_tts_model: string;
  azure_speech_region: string;
  // Presence booleans only — a key is never sent, not even truncated.
  has_gemini_key: boolean;
  has_azure_key: boolean;
  has_clerk_key: boolean;
  has_clerk_webhook_secret: boolean;
  has_resend_key: boolean;
  email_enabled: boolean;
  from_email: string | null;
  lead_notify_email: string | null;
  razorpay_configured: boolean;
  webhook_verifiable: boolean;
  razorpay_test_mode: boolean;
  cors_origins: string[];
  public_site_url: string;
  public_repo_url: string;
  tenant_base_domain: string;
  tenant_trust_forwarded_host: boolean;
  rate_limit_trust_forwarded_for: boolean;
  rate_limit_enabled: boolean;
  /**
   * Every GET the throttle has no rule of its own for, counted per session. The public
   * catalogue a server-rendered page reads is exempt, so this is a ceiling on paging
   * through a database rather than on a class opening the same page at once.
   */
  rate_limit_read: string;
  rate_limit_admin: string;
  rate_limit_lead: string;
  rate_limit_org: string;
  /**
   * Whether the throttle counters live in a Redis every worker shares, or in this one
   * process. A boolean and not the URL, because a Redis URL can carry a password — and
   * because several workers plus per-process counters means the published limits are
   * really the published limits times however many workers are running.
   */
  rate_limit_shared_storage: boolean;
  database_engine: string;
  db_auto_setup: boolean;
  plan_limits_enforced: boolean;
  free_daily_chats: number;
  free_assessment_total: number;
  quota_utc_offset_minutes: number;
  editable: false;
}

/** `/api/admin/content/blog` — the reason there is no blog editor on these screens. */
export interface AdminBlogStatus {
  editable_here: false;
  where: string;
  how: string;
  note: string;
}
