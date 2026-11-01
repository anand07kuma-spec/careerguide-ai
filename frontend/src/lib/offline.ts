/**
 * The one page-to-worker conversation about what this handset gets to keep.
 *
 * The worker (`public/sw.js`) will not go and take anything. It has no way to tell
 * whose `/api/conversations/<id>/messages` response it is looking at, and a worker
 * that guesses about ownership on a phone two children share is a privacy failure
 * waiting for a quiet afternoon. So the screen that read the conversation — the one
 * that knows it belongs to this device, because this device asked for it — hands it
 * over, and the worker stores only what it is handed and only under this browser's
 * own device id.
 *
 * Two things make that hand-off worth having at all, and both are the student's, not
 * the app's:
 *
 *  * `saveHistory` is the student's own switch (Settings → keep my history). A page
 *    that quietly cached what the student had just refused to keep would be the app
 *    breaking a promise a child made on purpose, so `false` here does not mean
 *    "skip" — it means "and drop whatever you were holding".
 *  * Leaving a conversation is leaving it. Ending one, clearing one, starting over
 *    and deleting an account each call `forgetConversation()` without being asked,
 *    because "my last conversation, offline" should never turn into "somebody
 *    else's last conversation, offline".
 *
 * Everything here is fire-and-forget and cannot throw: a chat that failed to report
 * itself to a worker is a chat that still happened, and it would be a worse app if
 * losing that copy lost the reply on screen too.
 */

import { deviceId } from "./device";

/** What the worker needs to draw a bubble, and nothing it could misuse. */
export interface StorableTurn {
  role: string;
  content: string;
  created_at: string;
}

export interface StorableConversation {
  id: number;
  kind: string;
  stage: number;
}

/**
 * Send the thread this screen is showing, or clear it.
 *
 * `saveHistory === false` clears rather than skips, for the reason in the header: the
 * copy on the device has to follow the switch, not the last time the switch was on.
 */
export function publishConversation(
  conversation: StorableConversation | null,
  turns: StorableTurn[],
  saveHistory: boolean
): void {
  if (!saveHistory) {
    forgetConversation();
    return;
  }
  post({
    type: "store-conversation",
    key: deviceId(),
    saveHistory: true,
    conversation,
    messages: turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
      created_at: turn.created_at,
    })),
  });
}

/**
 * Drop what this device is holding.
 *
 * No key means *this browser's whole private cache*, which is what leaving a
 * conversation should mean. The offline shell asks for the keyed version instead,
 * because a page that has not read the id should not be deleting on its behalf.
 */
export function forgetConversation(): void {
  post({ type: "clear-conversation", key: "" });
}

function post(message: Record<string, unknown>): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  // `ready` settles once a worker controls this page and never rejects. In `next dev`
  // nothing registers one — see `components/sw-registration.tsx` — so this simply
  // does nothing, which is the correct answer in the one environment where the
  // worker is deliberately absent.
  void navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(message);
    })
    .catch(() => {});
}
