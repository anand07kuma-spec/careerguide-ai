// Scratch check: does any Hindi key appear twice with a different translation?
// `hi/index.ts` merges one file per area with object spreads, so the later file
// silently wins — a conflict is a string that reads differently depending on
// which screen shows it.
import { readdirSync, readFileSync } from "node:fs";

const HI_DIR = "src/lib/hi";
// Read the merge order from index.ts rather than a copy of it here: a hardcoded
// list silently skipped any new dictionary file, which is exactly the file most
// likely to introduce a conflicting key.
const indexSrc = readFileSync(`${HI_DIR}/index.ts`, "utf8");
const aliasToFile = new Map();
for (const m of indexSrc.matchAll(/import\s*\{\s*HI\s+as\s+(\w+)\s*\}\s*from\s*"\.\/([\w-]+)"/g)) {
  aliasToFile.set(m[1], `${m[2]}.ts`);
}
const ORDER = [...indexSrc.matchAll(/\.\.\.(\w+),/g)]
  .map((m) => aliasToFile.get(m[1]))
  .filter(Boolean);

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
