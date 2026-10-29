"""Razorpay: creating an order, and checking that what came back was really theirs.

This is the only file in the app that talks to a payment provider, and the only thing
it can do is ask for an order and verify a signature. It never sees a card: the card
number, expiry and CVV go from Razorpay's own iframe to Razorpay's servers, and the
secret in this file is what proves that a "the money is captured" message came from
them rather than from a browser that would like it to be true.

Three properties this file is built to keep:

* **Nothing is trusted without the HMAC.** `verify_payment_signature` recomputes
  `order_id|payment_id` under the key secret and compares with `compare_digest`, and
  `verify_webhook_signature` does the same to the *raw request bytes*. The router that
  marks a plan paid is not allowed to act on a browser's word, and a webhook whose
  body was re-serialised before signing would never match — which is why the route
  hands over `await request.body()` and not parsed JSON.
* **The amount is never taken from the client.** `create_order` looks the price up in
  `plans.py` by code and sends that number. A client that named its own price would
  be buying a year of Pro for one rupee.
* **What goes to the provider is nothing about the child.** An order carries the
  amount, the currency, our own opaque receipt string and a short plan name. No name,
  no age, no class, no interests, no conversation, and no `prefill` contact details —
  a checkout sheet that already knows a student's email is a leak into a third party's
  records that no feature in this app needs.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
from typing import Any

import httpx
from fastapi import HTTPException, status

from ..config import get_settings
from . import plans

log = logging.getLogger(__name__)

# A human sentence for the case the keys are missing. Shaped exactly like Clerk's:
# refuse, name the missing variable, and say plainly that nothing was broken by the
# attempt — the alternative is a spinner that ends in a payment nobody made.
NOT_CONFIGURED = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail=(
        "Payments are not switched on for this deployment. Whoever runs this site "
        "needs to set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server. Until "
        "then nothing has been charged, your free plan is unaffected, and the "
        "pricing page still shows what each plan costs."
    ),
)

NO_WEBHOOK_SECRET = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail=(
        "This deployment cannot check Razorpay's webhook yet, because "
        "RAZORPAY_WEBHOOK_SECRET is not set. Every delivery is refused until it is — "
        "an unsigned body that could grant a paid plan would otherwise be a way to "
        "take a plan for nothing."
    ),
)

ORDER_TIMEOUT_SECONDS = 15.0

# Razorpay's own id shapes: `order_`/`pay_` plus a fixed-length alphanumeric. Checked
# before an hmac compare so a 4 MB string cannot be used to make the server do work.
_ID_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

# A sha256 hex digest is exactly 64 lowercase hex characters, and it is matched as that
# rather than truncated to it. Slicing `signature[:64]` before the compare would accept a
# real signature with anything at all appended — a cheap way for a slightly different
# looking string to still unlock a paid plan.
_SIGNATURE_HEX = re.compile(r"\A[0-9a-f]{64}\Z")


def _is_a_signature(value: Any) -> bool:
    return isinstance(value, str) and bool(_SIGNATURE_HEX.match(value.strip()))


class PaymentRejected(Exception):
    """A callback that did not verify. Never contains the secret or the payload."""


def configured() -> bool:
    return get_settings().razorpay_configured


def require_configured() -> None:
    if not configured():
        raise NOT_CONFIGURED


def key_id() -> str:
    """The publishable key. Sent to the browser; it authorises nothing on its own."""
    return get_settings().razorpay_key_id.strip()


def is_test_mode() -> bool:
    return get_settings().razorpay_test_mode


def _looks_like_an_id(value: str, prefix: str) -> bool:
    return (
        value.startswith(prefix)
        and 8 <= len(value) <= 64
        and all(character in _ID_CHARS or character == "_" for character in value)
    )


def _sign(message: str, secret: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Did Razorpay sign this order/payment pair with our key secret?

    The compare is constant-time. A timing difference on a hex digest is a thin side
    channel, but the thing on the other side of it is a paid plan, so there is no
    reason to leave even that open.
    """
    settings = get_settings()
    secret = settings.razorpay_key_secret.strip()
    if not secret:
        return False
    if not (_looks_like_an_id(order_id, "order_") and _looks_like_an_id(payment_id, "pay_")):
        return False
    if not _is_a_signature(signature):
        return False
    expected = _sign(f"{order_id}|{payment_id}", secret)
    return hmac.compare_digest(expected, signature.strip())


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Whether Razorpay sent these exact bytes.

    `raw_body` must be the request body before any parsing. Re-encoding the JSON to
    check it would change key order, spacing or unicode escapes, and a signature over
    bytes that differ from the ones Razorpay signed is a permanent rejection — the
    failure looks like an attack and is really a bug in the checker.
    """
    settings = get_settings()
    secret = settings.razorpay_webhook_secret.strip()
    if not secret or not raw_body:
        return False
    if not _is_a_signature(signature):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def create_order(plan_code: str, user_id: int, receipt: str) -> dict[str, Any]:
    """Ask Razorpay for an order worth exactly what `plan_code` costs.

    Returns the order id plus the handful of fields the browser needs to open the
    checkout sheet. The amount is read from `plans.py` and never from the request.
    """
    require_configured()
    settings = get_settings()

    plan = plans.get(plan_code)
    if plan is None or not plan.purchasable or plan.price_paise is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "That plan cannot be bought online here. The school licence is priced "
                "with a person — please use the contact page."
            ),
        )

    payload = {
        "amount": plan.price_paise,
        "currency": "INR",
        "receipt": receipt,
        # `notes` reach Razorpay's dashboard, so this carries our own reference and
        # the plan name and nothing else. No user id, no display name, no age band.
        "notes": {"cg_receipt": receipt, "cg_plan": plan.name},
    }

    try:
        response = httpx.post(
            f"{settings.razorpay_api_base}/orders",
            auth=(settings.razorpay_key_id.strip(), settings.razorpay_key_secret.strip()),
            json=payload,
            timeout=ORDER_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        log.warning("Could not reach Razorpay to create an order (%s)", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Razorpay could not be reached, so no order was made and nothing has "
                "been charged. Please try again in a minute."
            ),
        ) from exc

    if response.status_code >= 400:
        # Razorpay's error body is a JSON object with `field`/`message`. Its message is
        # about our key or our request, not about the child, so echoing the fact that
        # it refused is safe — the full body is logged rather than returned.
        log.warning("Razorpay refused the order (%s)", response.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Razorpay refused to open an order for this plan. Nothing has been "
                "charged. If this keeps happening, the keys on this server need "
                "checking — see the setup section of the README."
            ),
        )

    body = response.json()
    order_id = body.get("id")
    if not isinstance(order_id, str) or not _looks_like_an_id(order_id, "order_"):
        log.warning("Razorpay answered with something that is not an order id")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Razorpay's answer did not contain an order, so nothing has been charged.",
        )

    return {
        "order_id": order_id,
        "amount_paise": int(body.get("amount") or plan.price_paise),
        "currency": str(body.get("currency") or "INR"),
        "key_id": settings.razorpay_key_id.strip(),
        "plan_code": plan.code,
        "plan_name": plan.name,
        "receipt": receipt,
    }


def checkout_options(order: dict[str, Any]) -> dict[str, Any]:
    """The settings the browser hands to Razorpay's Checkout.

    Deliberately missing: `prefill` with anyone's email or phone. A child's contact
    details copied into a payment provider's transaction record is data this app has
    no reason to hand over and no way to get back.
    """
    settings = get_settings()
    return {
        "key": order["key_id"],
        "order_id": order["order_id"],
        "amount": order["amount_paise"],
        "currency": order["currency"],
        "name": settings.app_name,
        "description": f"{order['plan_name']} — {plans.rupees(order['amount_paise'])}",
        # Razorpay's own theme, so the card form inside the iframe is theirs and
        # nothing about a card is ever drawn by this app.
        "theme": {"backdrop_color": "#0F172A", "brand_color": "#2563EB"},
    }
