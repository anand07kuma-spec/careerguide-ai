/** The id this browser gives itself, and the only thing that recognises it.

 There is no account to create and no password to remember: the first visit makes
 a random id, the server binds a profile to it, and the next visit from this
 browser is picked up again. Clearing the browser's site data, or using another
 phone, means a new student — which is the tradeoff a no-login prototype makes.
*/

const DEVICE_KEY = "careerguide.device-id";

/** Same shape the server accepts for a device id: 16-64 of `-`, `_`, letters, digits. */
function makeId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function deviceId(): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(DEVICE_KEY);
  if (stored && stored.length >= 16 && stored.length <= 64) return stored;
  // Older Safari on iOS has no randomUUID; 16 random bytes as hex is just as good.
  const fresh = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : makeId();
  window.localStorage.setItem(DEVICE_KEY, fresh);
  return fresh;
}

/** Throw this browser's identity away, so the next page load is a new student. */
export function rotateDeviceId(): string {
  if (typeof window === "undefined") return "";
  window.localStorage.removeItem(DEVICE_KEY);
  return deviceId();
}
