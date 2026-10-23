/**
 * Every Hindi interface string, merged from one file per area so that adding
 * Hindi for a screen never means editing a shared file.
 *
 * Keys are the English source text, which means a string nobody translated
 * still renders — in English — instead of disappearing.
 */

import { HI as ACCOUNT } from "./account";
import { HI as ADMIN } from "./admin";
import { HI as ADMIN_CONTENT } from "./admin-content";
import { HI as CALL } from "./call";
import { HI as CAREERS } from "./careers";
import { HI as CHAT } from "./chat";
import { HI as INTERVIEW } from "./interview";
import { HI as COMMON } from "./common";
import { HI as DASHBOARD } from "./dashboard";
import { HI as EXAMS } from "./exams";
import { HI as ASSESSMENTS } from "./assessments";
import { HI as RESUME } from "./resume";
import { HI as ROADMAP } from "./roadmap";
import { HI as LEGAL } from "./legal";
import { HI as ONBOARDING } from "./onboarding";
import { HI as PARENT } from "./parent";
import { HI as PUBLIC_PAGES } from "./public-pages";
import { HI as STREAM } from "./stream";
import { HI as TRUST } from "./trust";
import { HI as WELCOME } from "./welcome";

export const HI: Record<string, string> = {
  ...ACCOUNT,
  ...COMMON,
  ...DASHBOARD,
  ...STREAM,
  ...EXAMS,
  ...LEGAL,
  ...CAREERS,
  ...ASSESSMENTS,
  ...RESUME,
  ...ROADMAP,
  ...TRUST,
  ...PUBLIC_PAGES,
  ...WELCOME,
  ...ONBOARDING,
  ...CHAT,
  ...INTERVIEW,
  ...CALL,
  ...PARENT,
  ...ADMIN,
  ...ADMIN_CONTENT,
};
