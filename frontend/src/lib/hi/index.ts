/**
 * Every Hindi interface string, merged from one file per area so that adding
 * Hindi for a screen never means editing a shared file.
 *
 * Keys are the English source text, which means a string nobody translated
 * still renders — in English — instead of disappearing.
 *
 * The last file spread wins a key that two files define, so a shared label lives
 * in exactly one of them. `node scripts/hi-duplicates.mjs` fails the build if that
 * rule slips; the spread order below follows the screens a student meets, not the
 * alphabet.
 */

import { HI as ACCOUNT } from "./account";
import { HI as SETTINGS } from "./settings";
import { HI as BILLING } from "./billing";
import { HI as COMMON } from "./common";
import { HI as DASHBOARD } from "./dashboard";
import { HI as CATALOGUE } from "./catalogue";
import { HI as SCHOLARSHIPS } from "./scholarships";
import { HI as STUDENT_TOOLS } from "./student-tools";
import { HI as REPORTS } from "./reports";
import { HI as PLANS_JOURNEY } from "./plans-journey";
import { HI as STREAM } from "./stream";
import { HI as EXAMS } from "./exams";
import { HI as LEGAL } from "./legal";
import { HI as CAREERS } from "./careers";
import { HI as ASSESSMENTS } from "./assessments";
import { HI as RESUME } from "./resume";
import { HI as ROADMAP } from "./roadmap";
import { HI as TRUST } from "./trust";
import { HI as PRICING } from "./pricing";
import { HI as LANDING } from "./landing";
import { HI as PUBLIC_PAGES } from "./public-pages";
import { HI as STUDY_ABROAD } from "./study-abroad";
import { HI as WELCOME } from "./welcome";
import { HI as ONBOARDING } from "./onboarding";
import { HI as CHAT } from "./chat";
import { HI as INTERVIEW } from "./interview";
import { HI as CALL } from "./call";
import { HI as PARENT } from "./parent";
import { HI as PORTAL } from "./portal";
import { HI as ADMIN } from "./admin";
import { HI as ADMIN_EXAMS } from "./admin-exams";
import { HI as ADMIN_CONTENT } from "./admin-content";

export const HI: Record<string, string> = {
  ...ACCOUNT,
  ...SETTINGS,
  ...BILLING,
  ...COMMON,
  ...DASHBOARD,
  ...CATALOGUE,
  ...SCHOLARSHIPS,
  ...STUDENT_TOOLS,
  ...REPORTS,
  ...PLANS_JOURNEY,
  ...STREAM,
  ...EXAMS,
  ...LEGAL,
  ...CAREERS,
  ...ASSESSMENTS,
  ...RESUME,
  ...ROADMAP,
  ...TRUST,
  ...PRICING,
  ...LANDING,
  ...PUBLIC_PAGES,
  ...STUDY_ABROAD,
  ...WELCOME,
  ...ONBOARDING,
  ...CHAT,
  ...INTERVIEW,
  ...CALL,
  ...PARENT,
  ...PORTAL,
  ...ADMIN,
  ...ADMIN_EXAMS,
  ...ADMIN_CONTENT,
};
