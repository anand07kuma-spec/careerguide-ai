import { AppShellSkeleton } from "@/components/ui/feedback";

/**
 * The HTML a signed-in route sends before its screen is ready.
 *
 * Every page under `/app` is a client component that asks for its own data with this
 * browser's token, so between the first byte and the first paint there is a round trip
 * to the server and a second one to the API. Without this file the browser sits on a
 * white page through both, and on the low-end handset over a patchy link that this app
 * is written for, a white page is indistinguishable from a broken one.
 *
 * It is the *frame* rather than the content for a reason worth keeping in mind when
 * editing: `/app` is twenty-odd screens with twenty-odd shapes, and a shell that drew a
 * dashboard in front of Settings would be a layout shift and a lie in one gesture. What
 * is drawn here — the navy column, the phone's header, the thumb bar — is the part every
 * one of those screens actually has, measured to the same numbers as `AppShell`, so the
 * real screen drops into place without moving anything.
 *
 * The sentence for anyone not looking is `RouteGuard`'s own `role="status"` line: this
 * file has no idea whether the account is being checked, redirected, or handed a page,
 * and it does not claim to.
 */
export default function AppLoading() {
  return <AppShellSkeleton />;
}
