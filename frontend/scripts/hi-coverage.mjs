// Scratch check: which English UI strings have no Hindi translation yet.
//
// Two lists, and they mean different things.
//
//   untranslated — the code hands the string to a translator and `src/lib/hi/` has no
//                  entry for it. A miss in the dictionary, one line to fix.
//   unreached    — the string reads like copy and never reaches a translator at all: a
//                  JSX text child, a single-quoted prop, an entry in an option list, a
//                  field of a card list that the file never asks `t()` for. A
//                  miss in the *component*, which is the expensive kind, because the
//                  student reads English and every dictionary check stays green.
//
// This file used to measure only the first. The branch that added 866 entries therefore
// reported `untranslated: 0` — true, and near useless: a string that was never wrapped
// cannot be missing from a dictionary it does not consult, and `/app/interests` was still
// printing "Early signals, not labels" and "Save my answer" in a Hindi interface.
//
// `untranslated` fails the check; `unreached` is a work list, because closing it means
// editing components and is deliberately done screen by screen rather than by a script.
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

// Not the interface. A share card is drawn to a PNG by the server before any reader
// picks a language, and `sitemap.ts` / `robots.ts` / `manifest.ts` are what a crawler
// reads, not a student — all four stay English on purpose.
const SKIP = [/opengraph-image/, /sitemap\.ts$/, /robots\.ts$/, /manifest\.ts$/];

// Every string literal handed to the translating primitives, whether through
// t()/tf() or through a title/description/label-style prop.
const PROPS =
  /((?:title|description|sub|detail|cta|ctaLabel|label|hint|retryLabel|placeholder|aria-label|emptyTitle|emptyDescription))=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\{\s*"((?:[^"\\]|\\.)*)"\s*\})/g;

// Whether a prop lands on a component or on a DOM element, decided by the tag's first
// letter. `src/components/ui/*` calls `t()` on the `title`, `description` and `label` it
// is given, so `<Card title="My plans">` really is reached; `<input aria-label="Search">`
// is an attribute the browser reads, and nothing translates it. Counting both as reached
// was how four screens came to have Hindi dictionaries and English screens.
//
// Walking back, an attribute expression is skipped whole. A tag written as
// `<CardHeader icon={<Info aria-hidden />} title="…">` has its tag name behind the braces,
// and reading `>` characters literally there finds the self-closing slash of the icon, not
// the end of the tag — which reported a translated prop as an unwired one.
const tagBefore = (src, index) => {
  let depth = 0;
  for (let i = index - 1; i >= 0; i--) {
    const c = src[i];
    if (c === "}") depth++;
    else if (c === "{") depth--;
    else if (c === "<" && depth === 0) {
      const name = /^[A-Za-z][\w.]*/.exec(src.slice(i + 1, index));
      return name ? name[0] : null;
    } else if (c === ">" && depth === 0) return null;
  }
  return null;
};
const CALLS = [
  /[^A-Za-z]t\(\s*"((?:[^"\\]|\\.)*)"/g,
  /[^A-Za-z]tf\(\s*"((?:[^"\\]|\\.)*)"/g,
  /[^A-Za-z]t\(\s*'((?:[^'\\]|\\.)*)'/g,
  // `translate()` is the same lookup for the helpers that run outside a component —
  // `relativeTime`, `kindLabel`. A literal handed to it reaches the dictionary exactly
  // as one handed to `t()` does.
  /[^A-Za-z]translate\(\s*"((?:[^"\\]|\\.)*)"/g,
];

// What the two lists are made of. A JSX child runs from a tag to the next tag, so both
// halves are read per line: one regex over a whole file would let a `=>` or a stray
// brace decide what prose is.
const JSX_CHILD = /(?:^|>|\{')\s*([A-Z][^<>{}|]*?)\s*(?:<|'\})/g;
const MAP_KEY = /^\s*"([A-Z][^"]{3,})"\s*:/;

// A card list is the third shape copy hides in: `const FEATURES = [{ title, body }]`,
// rendered by `{t(item.title)}`. Neither `PROPS` (which wants `title=`) nor `JSX_CHILD`
// sees it, so the landing page's six feature cards and four steps were invisible to both
// lists at once — translated in the file, missing from the dictionary, and reported green.
//
// The link back to the translator is the property name: a file that writes `t(item.body)`
// really does route every `body:` in it, so those count as reached and their absence from
// the dictionary fails the check. A `title:` in a file that never asks for `t(x.title)`
// stays on the work list, which is the honest reading.
const T_PROP =
  /[^A-Za-z](?:tf?|translate)\(\s*[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\s*[,)]/g;
const OBJ_COPY =
  /^\s*(title|body|sub|detail|label|text|heading|caption|hint|emptyTitle|emptyDescription|ctaLabel)\s*:\s*"((?:[^"\\]|\\.)*)"/;

// The fourth shape: `{HONEST_LIMITS.map((line) => <li>{t(line)}</li>)}`, where the copy
// sits in an array of bare strings. The map line names both halves — the array and the
// parameter that meets the translator — so reading them makes the elements checkable the
// same way a card list is. Restricted to `SCREAMING_CASE` constants, because those are the
// app's prose tables and nothing else.
const MAP_TO_T = /([A-Z][A-Z0-9_]*)\.map\(\((\w+)\)[\s\S]{0,200}?tf?\(\2\)/g;
const ARRAY_OPEN = /^const ([A-Z][A-Z0-9_]*) = \[$/;
const ARRAY_CLOSE = /^\];$/;
const ANY_LITERAL = /"((?:[^"\\]|\\.)*)"/g;

// A `pageMeta({...})` block is not the interface. It fills a browser tab, a shared-link
// card and a crawler's index, and this project keeps it English on purpose so a Hindi
// reader and a crawler are not handed two accounts of one URL — the same reason
// `opengraph-image` and `sitemap.ts` are skipped above. Its `title:` and `description:`
// would otherwise read exactly like card copy.
//
// The block is closed on the literal `});` rather than by counting braces: these are
// prose fields, and one brace inside a sentence would leave the state open and quiet the
// rest of the file.
const pageMetaBlock = (lines) => {
  const seo = new Set();
  let open = false;
  lines.forEach((line, i) => {
    if (open) {
      seo.add(i);
      if (line.trim() === "});") open = false;
      return;
    }
    if (line.includes("pageMeta({")) {
      seo.add(i);
      open = true;
    }
  });
  return seo;
};

const stripComments = (src) =>
  src
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// A sentence long enough to wrap is written as two literals joined with `+`, and `t()`
// receives the joined result. Reading them separately reported half a sentence as
// missing from a dictionary that has all of it. Both quotes go: leaving one would put a
// string boundary in the middle of the sentence again.
const joinSplitLiterals = (src) => src.replace(/"\s*\+\s*\n\s*"/g, "");

const IGNORED = "hi-coverage:ignore";

// Drop what the code marks: a marker on its own line takes the line after it with it
// (that is how a JSX child gets excused), and a marker carried on a line takes that line.
const dropIgnored = (src) => {
  const out = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const marked = lines[i].includes(IGNORED);
    if (marked && lines[i].trim() !== `// ${IGNORED}` && !lines[i].trim().startsWith("{/*")) {
      continue;
    }
    if (marked) {
      i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
};

// Copy, or something wearing copy's clothes: a class list, a storage key, an import,
// a `snake_case` identifier, a URL. Sentences have a space, start capitals, and none of
// those shapes. `{name}` is allowed — interpolated copy is still copy, and a quoted
// sentence starts with an opening quote mark rather than a capital.
const looksLikeCopy = (s) => {
  if (s.length < 5) return false;
  if (!/[a-z]{3}/.test(s)) return false;
  if (!/^[A-Z“]/.test(s)) return false;
  if (!/[A-Za-z]+ [a-z]+/.test(s)) return false;
  if (/\{[^a-zA-Z_}]/.test(s)) return false;
  const bare = s.replace(/\{[a-zA-Z_]+\}/g, "");
  // A semicolon ends a statement, so a string that carries one at its end is code. In the
  // middle it joins two halves of a sentence — "honest limits; a hosted deployment runs
  // several" — and rejecting every string that contains one hid a whole operator caption
  // that was sitting unwired in the markup.
  if (/[\\/<>=]|&#|&amp;/.test(bare) || /;\s*$/.test(bare)) return false;
  if (/^(https?|mailto|tel):/.test(s)) return false;
  if (/[a-z]+_[a-z]+|[a-z]+[A-Z][a-zA-Z]*\b/.test(bare.split(" ")[0])) return false;
  return true;
};

const reached = new Set();
const unreached = new Set();
const where = new Map();
const note = (set, raw, p) => {
  // A prop written across lines keeps its line breaks in the capture. The dictionary
  // is keyed on the sentence with one space between words, so compare that shape.
  const s = raw
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!looksLikeCopy(s)) return;
  set.add(s);
  if (!where.has(s)) where.set(s, []);
  const list = where.get(s);
  if (list.length < 3 && !list.includes(p)) list.push(p);
};

for (const p of PAGES) {
  if (p.startsWith("src/lib/hi") || SKIP.some((re) => re.test(p))) continue;
  const src = joinSplitLiterals(stripComments(dropIgnored(readFileSync(p, "utf8"))));
  let m;
  PROPS.lastIndex = 0;
  while ((m = PROPS.exec(src))) {
    const tag = tagBefore(src, m.index);
    const value = m[2] ?? m[3] ?? m[4];
    // An `aria-label` is a DOM attribute in every case here — the screen reader says it,
    // and no component in this app passes it through `t()`. A capitalised tag is a
    // component of this app, and the components that take a `title` or `placeholder` call
    // `t()` on it. Anything else is an attribute the browser reads. Counting all three as
    // reached was how four screens came to have Hindi dictionaries and English screens.
    const viaComponent = m[1] !== "aria-label" && tag !== null && /^[A-Z]/.test(tag);
    note(viaComponent ? reached : unreached, value, p);
  }
  for (const re of CALLS) while ((m = re.exec(src))) note(reached, m[1], p);

  const translatedProps = new Set();
  const tProp = new RegExp(T_PROP.source, T_PROP.flags);
  while ((m = tProp.exec(src))) translatedProps.add(m[1]);

  const translatedArrays = new Set();
  const mapToT = new RegExp(MAP_TO_T.source, MAP_TO_T.flags);
  while ((m = mapToT.exec(src))) translatedArrays.add(m[1]);

  const isOptionList = p.endsWith("src/lib/types.ts");
  const lines = src.split("\n");
  const seo = pageMetaBlock(lines);
  let inImportBlock = false;
  let proseArray = null;
  for (const [i, line] of lines.entries()) {
    if (seo.has(i)) continue;
    // A multi-line `import {` list has one name per line, and a name can read exactly
    // like a sentence ("University as UniversityIcon,"). It is never copy.
    if (/^import\b/.test(line)) inImportBlock = line.includes("{") && !line.includes("}");
    else if (inImportBlock && line.includes("}")) inImportBlock = false;
    if (inImportBlock) continue;
    if (/className=|href=|src=|import |from ["']|const \[|localStorage|sessionStorage|document\.|window\.|https?:/.test(line))
      continue;
    const opened = ARRAY_OPEN.exec(line);
    if (opened) {
      proseArray = translatedArrays.has(opened[1]) ? opened[1] : null;
      continue;
    }
    if (ARRAY_CLOSE.test(line)) {
      proseArray = null;
      continue;
    }
    if (proseArray) {
      const lit = new RegExp(ANY_LITERAL.source, ANY_LITERAL.flags);
      while ((m = lit.exec(line))) note(reached, m[1], p);
      continue;
    }
    const objCopy = OBJ_COPY.exec(line);
    if (objCopy) {
      note(translatedProps.has(objCopy[1]) ? reached : unreached, objCopy[2], p);
    }
    const jsx = new RegExp(JSX_CHILD.source, JSX_CHILD.flags);
    while ((m = jsx.exec(line))) note(unreached, m[1], p);
    // The commoner child: a line that is nothing but the sentence, sitting between the
    // opening tag above and the closing one below.
    if (p.endsWith(".tsx")) {
      const bare = line.trim();
      if (!/[<>=(){}"']/.test(bare) && !/^(?:return|else|case|await|if|function|export|default)\b/.test(bare))
        note(unreached, bare, p);
    }
    if (isOptionList) {
      const key = MAP_KEY.exec(line.trim());
      if (key) note(unreached, key[1], p);
    }
  }
}

// A string reached anywhere is reached; repeating it as a component bug would be noise.
for (const s of reached) unreached.delete(s);

const missing = [...reached].filter((s) => !dict.has(s));
const untouched = [...unreached].filter((s) => !dict.has(s));
const unwired = [...unreached].filter((s) => dict.has(s));

console.log(`\nuntranslated — handed to a translator, no entry: ${missing.length}`);
for (const s of missing) console.log(`  - ${s}   [${where.get(s).join(", ")}]`);

console.log(`\nunreached — reads like copy, never reaches a translator: ${untouched.length}`);
for (const s of untouched) console.log(`  - ${s}   [${where.get(s).join(", ")}]`);

console.log(`\nunwired — the dictionary has it, the screen never asks for it: ${unwired.length}`);
for (const s of unwired) console.log(`  - ${s}   [${where.get(s).join(", ")}]`);

process.exit(missing.length ? 1 : 0);
