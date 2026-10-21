// Scratch check: every English prose literal in the given files that has no
// Hindi entry. Catches strings handed to t() through a variable, which
// hi-coverage.mjs cannot see.
import { readFileSync, readdirSync } from "node:fs";

const HI_DIR = "src/lib/hi";
const dict = new Set();
for (const f of readdirSync(HI_DIR).filter((n) => n.endsWith(".ts") && n !== "index.ts")) {
  const src = readFileSync(`${HI_DIR}/${f}`, "utf8");
  const re = /^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z][A-Za-z0-9_]*))\s*:\s*"((?:[^"\\]|\\.)*)"/gm;
  let m;
  while ((m = re.exec(src))) dict.add((m[1] ?? m[2]).replace(/\\"/g, '"'));
}

const FILES = process.argv.slice(2);
const PROSE = /\s(the|and|of|to|is|a|in|for|with|not|this|that|it|on|your|we|an|are)\s/i;
const LITERAL = /"((?:[^"\\]|\\.)*)"/g;

const missing = [];
for (const p of FILES) {
  const src = readFileSync(p, "utf8");
  let m;
  while ((m = LITERAL.exec(src))) {
    const s = m[1].replace(/\n/g, "").replace(/\s+/g, " ");
    if (s.length < 4) continue;
    if (!s.includes(" ")) continue;
    if (!PROSE.test(` ${s} `)) continue;
    if (!dict.has(s)) missing.push({ p, s });
  }
}

console.log(`prose literals missing from Hindi: ${missing.length}`);
for (const item of missing) console.log(`MISSING [${item.p}] ${item.s}`);
