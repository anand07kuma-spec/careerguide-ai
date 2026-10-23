/**
 * The contract between the assessment screens and `/api/assessments`.
 *
 * These three screens show a child their own answers, so a response that arrives in
 * an unexpected shape must stop here rather than render `undefined` into a number
 * the family reads as a verdict. Every payload the screens draw from is parsed
 * against the schemas below; a mismatch becomes one honest error message.
 *
 * The scorer's arithmetic lives on the server (`app/services/scoring.py`). Nothing
 * here computes a score — the screens only label what came back.
 */

import { z } from "zod";

export const ASSESSMENT_TYPES = ["interest", "personality", "aptitude"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

/** Interface language is English or Hindi; the item wording follows `item_language`. */
const languageSchema = z.enum(["en", "hi"]);

const latestSchema = z.object({
  assessment_id: z.number(),
  status: z.string(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  result_id: z.number().nullable(),
});

const instrumentSchema = z.object({
  type: z.enum(ASSESSMENT_TYPES),
  name: z.string(),
  blurb: z.string(),
  minutes: z.number(),
  min_class: z.number(),
  item_count: z.number(),
  available: z.boolean(),
  reason: z.string(),
  latest: latestSchema.nullable(),
});

export const catalogueSchema = z.object({
  instruments: z.array(instrumentSchema),
  note: z.string(),
  language: languageSchema,
});

export const startReceiptSchema = z.object({
  assessment_id: z.number(),
  resumed: z.boolean(),
  language: languageSchema,
  status: z.string(),
  item_count: z.number(),
});

const scalePointSchema = z.object({
  value: z.number().int().min(1).max(5),
  label: z.string(),
});

const questionSchema = z.object({
  code: z.string(),
  text: z.string(),
  response_type: z.enum(["likert", "choice"]),
  // Only a puzzle item carries options, and never its answer: the key stays on the
  // server, so no DevTools session can read it off this screen.
  options: z.array(z.object({ value: z.string(), label: z.string() })),
});

export const sessionSchema = z.object({
  assessment_id: z.number(),
  assessment_type: z.enum(ASSESSMENT_TYPES),
  language: languageSchema,
  status: z.string(),
  completed_at: z.string().nullable(),
  result_id: z.number().nullable(),
  name: z.string(),
  caveat: z.string(),
  scale: z.array(scalePointSchema),
  answered: z.record(z.string(), z.string()),
  items: z.array(questionSchema),
});

export const answerReceiptSchema = z.object({
  saved: z.boolean(),
  code: z.string(),
  value: z.string(),
  answered: z.number(),
  item_count: z.number(),
});

/** One area as the scorer left it: a number, a band and the counts under it. This is
 * what `scores` holds, keyed by dimension — the raw arithmetic, with no label. */
const scoredSchema = z.object({
  kind: z.enum(["likert", "choice"]),
  answered: z.number(),
  total: z.number(),
  correct: z.number().nullable(),
  score: z.number().int().min(0).max(100).nullable(),
  band: z.string(),
});

/** The same area with the words to show a child beside it. `score` is null until at
 * least two items in that area are answered — an area of one answer is not a
 * measurement, and the screen shows `band_label` instead of a number. */
const dimensionSchema = z.object({
  dimension: z.string(),
  name: z.string(),
  blurb: z.string(),
  kind: z.enum(["likert", "choice"]),
  score: z.number().int().min(0).max(100).nullable(),
  band: z.string(),
  band_label: z.string(),
  answered: z.number(),
  total: z.number(),
  correct: z.number().nullable(),
});

/**
 * The plan on a finished result: what the top career still asks for, and four weeks.
 *
 * This is the *rendered* plan, not the stored one. `services/roadmap.py` keeps
 * language-neutral data and picks the sentences at read time, which is why the two
 * sources arrive with slightly different shapes and this schema has to hold both:
 *
 * * `rules` — the app's own arithmetic. `strengths[].label` is a question-bank area
 *   name already in the language the page asked for, `gaps[].label` is one of the eight
 *   theme names in `hi/common.ts`, and a week title and step are finished sentences.
 * * a model — prose in `text_language`, with `score: null` on every strength and no
 *   `unmeasured` list, because the model was never shown which areas had too few answers.
 *
 * Nothing here is a claim about the child. `career_skills` are what the work asks for,
 * and the copy on the page must keep saying so.
 */
export const roadmapSchema = z.object({
  /** "rules", or the configured provider's name. Never inferred from a badge. */
  source: z.string(),
  /** True for the rules plan. The page labels the other kind as model-written. */
  demo_generated: z.boolean(),
  generated_at: z.string().nullable(),
  /** Which language a model answered in. Null on a rules plan, which has no such thing. */
  text_language: z.string().nullable(),
  career: z
    .object({
      slug: z.string(),
      title: z.string(),
      category: z.string(),
      needs_verification: z.boolean(),
    })
    .partial(),
  summary: z.string(),
  strengths: z.array(
    z.object({
      label: z.string(),
      score: z.number().int().min(0).max(100).nullable(),
      band_label: z.string().optional(),
    }),
  ),
  gaps: z.array(
    z.object({
      label: z.string(),
      /** "low", "middle", "unmeasured" from the rules, "ai" from a model. A string, not
       * an enum: a new reason must not blank a child's whole result page. */
      reason: z.string(),
      detail: z.string(),
    }),
  ),
  /** Areas with too few answers to score. Listed as unknown, never as a gap. */
  unmeasured: z.array(z.object({ label: z.string() })),
  career_skills: z.array(z.string()),
  weeks: z.array(
    z.object({
      week: z.number().int(),
      title: z.string(),
      steps: z.array(z.object({ text: z.string() })),
    }),
  ),
  note: z.string(),
});

export const resultSchema = z.object({
  result_id: z.number(),
  assessment_id: z.number(),
  assessment_type: z.enum(ASSESSMENT_TYPES),
  name: z.string(),
  item_language: languageSchema,
  completed_at: z.string(),
  scores: z.record(z.string(), scoredSchema),
  traits: z.array(dimensionSchema),
  top_traits: z.array(dimensionSchema),
  totals: z.object({
    items: z.number(),
    answered: z.number(),
    ignored: z.number(),
    completeness: z.number(),
  }),
  themes: z.array(z.string()),
  careers: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      category: z.string(),
      needs_verification: z.boolean(),
      /** The theme names this career matched on, in the server's own English words.
       *  Each is a key in the Hindi dictionary, so the sentence is built here. */
      matched: z.array(z.string()),
    }),
  ),
  career_note: z.string(),
  caveats: z.array(z.string()),
  /** The gap and the four weeks, or null when this sitting has no plan: either it was
   * taken before plans existed, or no career matched its answers well enough to aim one
   * at. The page says which rather than printing an empty card. */
  roadmap: roadmapSchema.nullable(),
  /** Whether the ✨ button would reach a model at all. The button is hidden when false —
   * one that quietly returns the same rules plan is a dead button with a sparkly icon. */
  roadmap_ai_available: z.boolean(),
  /** Set only by the click that failed, for exactly one page load. */
  roadmap_note: z.string().nullable(),
});

/**
 * One printed report, as the server describes it.
 *
 * The bytes are never in here. `download_path` is a route behind the same bearer
 * token as every other call, so it is a path this app fetches and turns into a blob
 * URL — not a link that works in an address bar or a browser history on a shared
 * laptop. A page that put it in an `<a href>` would leak a child's answers.
 */
export const pdfReportSchema = z.object({
  id: z.number(),
  result_id: z.number(),
  filename: z.string(),
  language: languageSchema,
  size_bytes: z.number(),
  generated_at: z.string(),
  result_ids: z.array(z.number()),
  download_path: z.string(),
  /** False when the stored file already held exactly the results that exist now. */
  generated: z.boolean(),
});

/** Every report this student has, newest first. The server never sends the bytes
 * here, so a list is safe to hold in memory even when the files are not. */
export const pdfReportListSchema = z.array(pdfReportSchema);

/**
 * One finished questionnaire, newest first, as the profile page lists them.
 *
 * The catalogue endpoint answers with the one sitting to continue; a profile needs
 * all of them, including the second time the same questionnaire was taken. `name`
 * arrives in the language the page is read in, while `language` is the language the
 * questions were actually asked in — the two differ as soon as a Hindi student takes
 * an English questionnaire.
 */
export const sittingSchema = z.object({
  result_id: z.number(),
  assessment_id: z.number(),
  assessment_type: z.enum(ASSESSMENT_TYPES),
  name: z.string(),
  language: languageSchema,
  completed_at: z.string(),
  answered: z.number(),
  total: z.number(),
});

export const sittingListSchema = z.array(sittingSchema);

export type AssessmentCatalogue = z.infer<typeof catalogueSchema>;
export type AssessmentInstrument = AssessmentCatalogue["instruments"][number];
export type StartReceipt = z.infer<typeof startReceiptSchema>;
export type AssessmentSession = z.infer<typeof sessionSchema>;
export type AssessmentQuestion = AssessmentSession["items"][number];
export type ScalePoint = AssessmentSession["scale"][number];
export type AnswerReceipt = z.infer<typeof answerReceiptSchema>;
export type AssessmentResult = z.infer<typeof resultSchema>;
export type RoadmapPlan = z.infer<typeof roadmapSchema>;
export type RoadmapWeek = RoadmapPlan["weeks"][number];
export type PdfReport = z.infer<typeof pdfReportSchema>;
export type Sitting = z.infer<typeof sittingSchema>;
export type DimensionTrait = AssessmentResult["traits"][number];

export function isAssessmentType(value: string | undefined): value is AssessmentType {
  return value !== undefined && (ASSESSMENT_TYPES as readonly string[]).includes(value);
}

/** The order the three cards are shown in, whatever order the server returns. */
export const INSTRUMENT_ORDER: AssessmentType[] = ["interest", "personality", "aptitude"];
