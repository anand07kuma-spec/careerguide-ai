/** Opening Razorpay's Checkout, without a secret in the browser.

The `razorpay` npm package is the **server** SDK: its job is to call the Razorpay API with
a key secret. Installing it here would mean either shipping that secret to every visitor
or keeping a package whose only purpose is defeated by the browser, so this file does the
one thing a browser legitimately can — it loads the script Razorpay publishes for
checkout, on the click that asks for it, and hands over the order the server already
priced.

What this file deliberately does *not* do:

* It never builds a card form. Everything inside the sheet Razorpay draws is theirs, which
  is why the CSP allows `checkout.razorpay.com` and why no input on this site can ever see
  a card number.
* It never trusts the callback. Checkout is happy to say "paid"; the value returned here is
  passed to `api.verifyPayment`, and only the server's HMAC check turns it into a plan. A
  browser that edited this response would be editing a message its own request then has to
  get signed — see `backend/app/routers/payments.py`.
* It adds no `prefill`. A child's email or phone copied into a payment provider's
  transaction record is data this app has no reason to hand over.

The CSP in `src/middleware.ts` must allow the script's origin, and the Permissions-Policy
must allow `payment` for it, or the sheet opens blank. Both are conditional on the key
being configured.
 */

import type { CheckoutOptions, PaymentConfirmation } from "./types";

export const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface CheckoutInstance {
  on(event: string, handler: (response: CheckoutResponse) => void): void;
  open(): void;
}

type CheckoutConstructor = new (options: Record<string, unknown>) => CheckoutInstance;

/** What Checkout passes to the callbacks. Every field is optional because a failure
 * delivery carries `error` and none of the ids, and a missing id is a failure. */
type CheckoutResponse = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  error?: { code?: string; description?: string };
};

declare global {
  interface Window {
    Razorpay?: CheckoutConstructor;
  }
}

let loading: Promise<void> | null = null;

/** Loads the checkout script once and reuses the promise for every later click. */
function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The payment page only opens in a browser."));
  }
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Dropping the cached promise means the next click tries again rather than
        // replaying the same failure forever.
        loading = null;
        script.remove();
        reject(
          new Error(
            "The payment page could not be loaded. That is usually a blocked connection or a " +
              "content blocker — nothing has been charged, so please try again.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

export interface CheckoutHandlers {
  /** Called with the ids to verify. The plan changes only if the server agrees they are real. */
  onPaid: (confirmation: PaymentConfirmation) => void;
  /** The family closed the sheet without paying. */
  onDismissed: () => void;
  /** A declined payment, or a callback that arrived without the fields needed to verify it. */
  onProblem: (message: string) => void;
}

/**
 * Shows Razorpay's Checkout for an order this server created.
 *
 * `settled` guards the three ways this can end: a paid callback, a failure callback, and a
 * dismissed modal. Firing more than one would let a screen show "paid" and "cancelled" for
 * the same attempt.
 */
export async function openCheckout(
  options: CheckoutOptions,
  handlers: CheckoutHandlers,
): Promise<void> {
  await loadCheckoutScript();
  const Constructor = window.Razorpay;
  if (!Constructor) {
    throw new Error("The payment page loaded but did not start. Nothing has been charged.");
  }

  let settled = false;
  const once = (run: () => void) => {
    if (settled) return;
    settled = true;
    run();
  };

  const checkout = new Constructor({
    ...options,
    handler: (response: CheckoutResponse) => {
      const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
        response;
      if (!orderId || !paymentId || !signature) {
        once(() =>
          handlers.onProblem(
            "The payment page finished without a reference we can check. If money left your " +
              "account it will appear on this page shortly — please do not pay again yet.",
          ),
        );
        return;
      }
      once(() =>
        handlers.onPaid({
          order_id: orderId,
          payment_id: paymentId,
          razorpay_signature: signature,
        }),
      );
    },
    modal: { ondismiss: () => once(handlers.onDismissed) },
  });

  checkout.on("payment.failed", (response: CheckoutResponse) =>
    once(() =>
      handlers.onProblem(
        response.error?.description?.trim() ||
          "That payment did not go through. Nothing was charged, and your plan is unchanged.",
      ),
    ),
  );

  checkout.open();
}
