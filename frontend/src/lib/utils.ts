import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { translate } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CLASS_LABELS: Record<string, string> = {
  "class-6": "Class 6",
  "class-7": "Class 7",
  "class-8": "Class 8",
  "class-9": "Class 9",
  "class-10": "Class 10",
  "class-11": "Class 11",
  "class-12": "Class 12",
};

export function classLabel(value: string | null | undefined) {
  if (!value) return null;
  // Deliberately keeps the digits: a caller parses them back out to match a
  // resource against a class band.
  return translate(CLASS_LABELS[value] ?? value.replace(/-/g, " "));
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** A relative time is interface copy, not data: every screen that shows one reads
 * it out in the visitor's language. `{n}` stays in the key so the Hindi entry can
 * put the number where Hindi grammar wants it. */
function when(en: string, n: number) {
  return translate(en).replace("{n}", String(n));
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return translate("just now");
  if (minutes < 60) return when("{n} min ago", minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return when("{n} hr ago", hours);
  const days = Math.round(hours / 24);
  if (days < 30) return when(days === 1 ? "{n} day ago" : "{n} days ago", days);
  return new Date(iso).toLocaleDateString();
}

export function clockText(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Turns a career title into a stable, accent-free key for CSS and analytics. */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const CATEGORY_TINTS = [
  "bg-brand-mist text-brand-dark",
  "bg-teal-mist text-teal",
  "bg-warning-mist text-amber-700",
  "bg-success-mist text-success",
  "bg-danger-mist text-danger",
  "bg-indigo-100 text-indigo-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

export function categoryTint(category: string) {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) hash = (hash * 31 + category.charCodeAt(i)) | 0;
  return CATEGORY_TINTS[Math.abs(hash) % CATEGORY_TINTS.length];
}
