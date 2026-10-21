import type { ReactNode } from "react";

/**
 * JSON-LD structured data.
 *
 * A search engine reads this block instead of the page, so the rule it is built
 * under is the same one the visible copy follows: describe only what is true of
 * this build. That is why there is no `AggregateRating`, no invented duration,
 * and no `sameAs` list pointing at social profiles that do not exist.
 *
 * Two characters are escaped on the way out. Angle brackets must not be able to
 * close the element early. The Unicode line separators are valid inside JSON but
 * not inside a JavaScript string literal, and free-text career descriptions are
 * exactly the kind of field that can carry one — they are built by name here
 * rather than written as literals so this file stays plain ASCII.
 */

const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, "g");

function escapeForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(LINE_SEPARATORS, (character) => `\\u${character.charCodeAt(0).toString(16)}`);
}

export function JsonLd({ data }: { data: object | object[] }): ReactNode {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeForScript(JSON.stringify(data)) }}
    />
  );
}
