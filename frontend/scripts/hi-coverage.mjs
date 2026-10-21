// Scratch check: which English UI strings have no Hindi translation yet.
import { readFileSync, readdirSync } from "node:fs";

const HI_DIR = "src/lib/hi";

const dict = new Map();
for (const f of readdirSync(HI_DIR).filter((n) => n.endsWith(".ts") && n !== "index.ts")) {
  const src = readFileSync(`${HI_DIR}/${f}`, "utf8");
  const re = /^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z][A-Za-z0-9_]*))\s*:\s*"((?:[^"\\]|\\.)*)"/gm;
  let m;
  while ((m = re.exec(src))) {
    const key = (m[1] ?? m[2]).replace(/\\"/g, '"');
    if (!dict.has(key)) dict.set(key, f);
  }
}
console.log(`dictionary keys: ${dict.size}`);

const PAGES = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) PAGES.push(p);
  }
};
walk("src/app");
walk("src/components");
walk("src/lib");

// Every string literal handed to the translating primitives, whether through
// t()/tf() or through a title/description/label-style prop.
const PROPS =
  /(title|description|sub|detail|cta|label|retryLabel|placeholder|aria-label|emptyTitle|emptyDescription)=\s*"((?:[^"\\]|\\.)*)"/g;
const CALLS = [/[^A-Za-z]t\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g, /[^A-Za-z]tf\(\s*"((?:[^"\\]|\\.)*)"/g];

const found = new Set();
const where = new Map();
const note = (s, p) => {
  found.add(s);
  if (!where.has(s)) where.set(s, []);
  const list = where.get(s);
  if (list.length < 3 && !list.includes(p)) list.push(p);
};

for (const p of PAGES) {
  if (p.startsWith("src/lib/hi")) continue;
  const src = readFileSync(p, "utf8");
  let m;
  while ((m = PROPS.exec(src))) note(m[2].replace(/\\"/g, '"'), p);
  for (const re of CALLS) {
    while ((m = re.exec(src))) note(m[1].replace(/\\"/g, '"'), p);
  }
}

const missing = [...found].filter((s) => !dict.has(s));
console.log(`candidate strings: ${found.size}, untranslated: ${missing.length}`);
for (const s of missing) console.log(`  - ${s}   [${where.get(s).join(", ")}]`);
