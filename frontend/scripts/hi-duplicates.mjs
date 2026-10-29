// Scratch check: does any Hindi key appear twice with a different translation?
// `hi/index.ts` merges one file per area with object spreads, so the later file
// silently wins — a conflict is a string that reads differently depending on
// which screen shows it.
import { readdirSync, readFileSync } from "node:fs";

const HI_DIR = "src/lib/hi";
// Kept in the same order as the spreads in `hi/index.ts`, because the order is the
// whole point: it decides which file wins a key that two of them define. A new
// area file goes into this list beside its neighbours in `index.ts` or the check
// goes blind to it.
const ORDER = [
  "account.ts",
  "settings.ts",
  "billing.ts",
  "common.ts",
  "dashboard.ts",
  "catalogue.ts",
  "plans-journey.ts",
  "stream.ts",
  "exams.ts",
  "legal.ts",
  "careers.ts",
  "assessments.ts",
  "resume.ts",
  "roadmap.ts",
  "trust.ts",
  "pricing.ts",
  "public-pages.ts",
  "study-abroad.ts",
  "welcome.ts",
  "onboarding.ts",
  "chat.ts",
  "interview.ts",
  "call.ts",
  "parent.ts",
  "portal.ts",
  "admin.ts",
  "admin-exams.ts",
  "admin-content.ts",
];

const ENTRY =
  /^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z][A-Za-z0-9_]*))\s*:\s*"((?:[^"\\]|\\.)*)"/gm;

const seen = new Map();
let conflicts = 0;

for (const file of ORDER) {
  const src = readFileSync(`${HI_DIR}/${file}`, "utf8");
  let match;
  while ((match = ENTRY.exec(src))) {
    const key = (match[1] ?? match[2]).replace(/\\"/g, '"');
    const value = match[3];
    const prior = seen.get(key);
    if (prior && prior.value !== value) {
      conflicts += 1;
      console.log(`CONFLICT ${JSON.stringify(key)}`);
      console.log(`  ${prior.file}: ${JSON.stringify(prior.value)}`);
      console.log(`  ${file}: ${JSON.stringify(value)}   <- this one renders`);
    } else if (prior) {
      console.log(`harmless repeat: ${JSON.stringify(key)} (${prior.file}, ${file})`);
    }
    if (!prior) seen.set(key, { file, value });
  }
}

const files = readdirSync(HI_DIR).filter((n) => n.endsWith(".ts") && n !== "index.ts");
for (const f of files) {
  if (!ORDER.includes(f)) console.log(`NOT IN MERGE ORDER: ${f}`);
}

console.log(`keys: ${seen.size}, conflicting duplicates: ${conflicts}`);
process.exit(conflicts > 0 ? 1 : 0);
