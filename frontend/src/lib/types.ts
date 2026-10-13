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

export const CLASS_OPTIONS = [
  { value: "class-3", label: "Class 3" },
  { value: "class-4", label: "Class 4" },
  { value: "class-5", label: "Class 5" },
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

export interface OnboardingPayload {
  role: Role;
  display_name: string;
  preferred_language: Language;
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

export interface Health {
  status: string;
  storage: string;
  ai_provider: string;
  ai_configured: boolean;
  tts_provider: string;
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
