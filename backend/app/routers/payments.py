"""The money routes: a price list, an order, a verified payment, a webhook.

Read the shape of these five routes as one rule: **the client may name a plan, and
never anything else about the transaction.** The amount, the currency, the period
length and whose account it unlocks are all looked up server-side — from `plans.py`
and from the order row this server wrote before the checkout sheet even opened. A
request that could set its own price would be buying a year of Pro for one rupee, and
a request that could set its own `user_id` would be unlocking a stranger's account, so
neither field exists in any body here.

Two of the five routes can be reached without a signed-in caller, and both are
deliberate:

* `GET /plans` is the public price list. A family deciding whether to pay should be
  able to read the terms before they have an account, and the page is rendered from
  the same objects the limiter enforces.
* `POST /webhook` is Razorpay telling us about a payment. It carries no bearer token —
  it carries an HMAC over its own raw bytes, which is checked before a single field is
  read, and every delivery is refused outright when the webhook secret is missing.

`payments_enabled` appears in two responses because the buttons in the browser have to
know what this server can actually do. With no keys configured, nothing here pretends:
the order route answers 503 naming the two variables, and the pricing page says
payments are not switched on rather than opening a checkout that could not finish.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..middleware.rate_limit import payment_limit
from ..models import Payment, User
from ..schemas import (
    BillingOut,
    CreateOrderIn,
    CreateOrderOut,
    DowngradeIn,
    FeatureRowOut,
    PaymentOut,
    PlanDetailOut,
    PricingPlanOut,
    PricingOut,
    UsageOut,
    VerifyIn,
)
from ..security import get_current_user
from ..services import email_jobs, entitlements, plans, razorpay

router = APIRouter(prefix="/api/payments", tags=["payments"])

log = logging.getLogger(__name__)

# The events this app acts on, and the ones it does not. Listed rather than defaulted
# so that a new event type arrives as a logged "ignored", never as a silent branch that
# might have unlocked a plan.
CAPTURED = "payment.captured"
FAILED = "payment.failed"

NOT_YOURS = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=(
        "There is no order here with that reference for your account. If a payment "
        "was made on another device, it belongs to that account — nothing has been "
        "charged to this one."
    ),
)


def _plan_out(plan: plans.Plan) -> PricingPlanOut:
    return PricingPlanOut(
        code=plan.code,
        name=plan.name,
        tagline=plan.tagline,
        price_paise=plan.price_paise,
        compare_at_paise=plan.compare_at_paise,
        savings_paise=plans.savings_paise(plan),
        savings_percent=plans.savings_percent(plan),
        interval=plan.interval,
        period_days=plan.period_days,
        cta=plan.cta,
        purchasable=plan.purchasable,
        daily_chats=plan.daily_chats,
        total_assessments=plan.total_assessments,
        pdf_reports=plan.pdf_reports,
        parent_dashboard=plan.parent_dashboard,
        features=dict(plan.features),
    )


@router.get("/plans", response_model=PricingOut)
def price_list() -> PricingOut:
    """Every plan, its real price, and the limits that are actually in force.

    Public, unthrottled and unauthenticated: it holds no person's data at all.
    """
    return PricingOut(
        plans=[_plan_out(plan) for plan in plans.all_plans()],
        features=[
            FeatureRowOut(key=key, label=label, help=help_text)
            for key, label, help_text in plans.FEATURE_ROWS
        ],
        payments_enabled=razorpay.configured(),
        test_mode=razorpay.is_test_mode(),
        limits_enforced=get_settings().plan_limits_enforced,
    )


@router.get("/me", response_model=BillingOut)
def billing(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> BillingOut:
    """What the billing screen shows about the signed-in account. Nothing else.

    There is no `user_id` in this request. The account is taken from the bearer token
    the same way every other read here does it, which is what makes "change an id in the
    request and see another family's invoices" impossible rather than merely discouraged.
    """
    rows = list(
        db.scalars(
            select(Payment).where(Payment.user_id == user.id).order_by(Payment.id.desc()).limit(24)
        )
    )
    return BillingOut(
        plan=PlanDetailOut.model_validate(entitlements.plan_detail(db, user)),
        usage=UsageOut.model_validate(entitlements.usage(db, user)),
        payments=[PaymentOut.model_validate(row) for row in rows],
        payments_enabled=razorpay.configured(),
        test_mode=razorpay.is_test_mode(),
        key_id=razorpay.key_id() if razorpay.configured() else None,
    )


@router.post("/create-order", response_model=CreateOrderOut)
@payment_limit
def create_order(
    request: Request,
    payload: CreateOrderIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateOrderOut:
    """Open an order for a named plan, priced by the server.

    The order row is written *before* the browser sees an id, with the amount frozen at
    the price of the moment. Verification later compares against that row, so a plan
    whose price changed mid-checkout cannot be unlocked at the new price or the old one
    by whoever typed the request.
    """
    if not payload.adult_attested:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "A payment has to be made by an adult who can pay for this student. "
                "Ask a parent or guardian to confirm that on the pricing page — the "
                "student's own free plan is unaffected either way."
            ),
        )

    plan = plans.get(payload.plan_code)
    if plan is None or not plan.purchasable or plan.price_paise is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="That plan cannot be bought online here.",
        )

    now = datetime.now(timezone.utc)
    order = razorpay.create_order(plan.code, user.id, entitlements.new_receipt(user.id, plan.code, now))
    payment = Payment(
        user_id=user.id,
        provider="razorpay",
        order_id=order["order_id"],
        plan_code=plan.code,
        interval=plan.interval or "monthly",
        amount_paise=order["amount_paise"],
        currency=order["currency"],
        status="created",
        receipt=order["receipt"],
        adult_attested=True,
        test_mode=razorpay.is_test_mode(),
    )
    db.add(payment)
    db.commit()

    return CreateOrderOut(
        order_id=order["order_id"],
        amount_paise=order["amount_paise"],
        currency=order["currency"],
        plan_code=plan.code,
        plan_name=plan.name,
        receipt=order["receipt"],
        checkout=razorpay.checkout_options(order),
    )


def _lockable_order(db: Session, order_id: str) -> Payment | None:
    """Find an order, and on Postgres hold its row while it is being changed.

    The lock is conditional because SQLite has no `FOR UPDATE`: emitting it there is a
    syntax error, not a no-op. What is being defended against is a webhook delivery and
    the browser's own callback arriving at the same moment for the same payment — the
    loser of that race must not extend the paid period a second time.
    """
    statement = select(Payment).where(Payment.order_id == order_id)
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        statement = statement.with_for_update()
    return db.scalars(statement).first()


def _mark_captured(db: Session, payment: Payment, payment_id: str, now: datetime) -> bool:
    """Advance one payment to captured. False if it was already captured.

    The status transition is the idempotency guard. Razorpay retries a delivery it does
    not get a 2xx for, and a family that pays and then refreshes will hit both the
    callback and the webhook; without this, each of those would add another thirty days
    to a plan that was paid for once.

    The receipt is queued through the same guard rather than sent inline, and that is
    the reason this lives here instead of in the two callers: one row per captured
    payment, decided by the unique index, so the race the transition already prevents
    for the money is prevented for the mail as well. Two receipts for one payment is
    worse than none — it reads like a second charge. A family that cannot be mailed
    (no confirmed address) simply gets no row, which the billing page already covers:
    it shows the same reference the receipt would have carried.
    """
    if payment.status == "captured":
        return False
    payment.status = "captured"
    payment.payment_id = payment_id
    payment.captured_at = now
    payment.failure_reason = None
    entitlements.apply_captured_payment(db, payment.user_id, payment.plan_code, now)
    email_jobs.try_now(
        db, email_jobs.enqueue(db, payment.user_id, "receipt", ref_id=payment.id)
    )
    return True


@router.post("/verify", response_model=PaymentOut)
@payment_limit
def verify(
    request: Request,
    payload: VerifyIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentOut:
    """Confirm a checkout the browser says happened — only if Razorpay signed it.

    The signature is checked against *this* order and payment pair under the key
    secret. Then two more things have to hold before a plan is unlocked: the order must
    belong to the caller, and the amount on the order row must be the price the plan
    carries. A valid signature over somebody else's order is still somebody else's
    order.
    """
    if not razorpay.verify_payment_signature(
        payload.order_id, payload.payment_id, payload.razorpay_signature
    ):
        # Deliberately vague about which of the three did not line up.
        log.info("Rejected an unverified payment callback for order %s", payload.order_id[:12])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "That payment could not be confirmed with the payment provider, so no "
                "plan has been changed. If money left your account, it will show on "
                "this page within a few minutes — do not pay again yet."
            ),
        )

    payment = _lockable_order(db, payload.order_id)
    if payment is None or payment.user_id != user.id:
        raise NOT_YOURS

    plan = plans.get(payment.plan_code)
    if plan is None or plan.price_paise != payment.amount_paise:
        log.warning("Order %s carries an amount no plan costs", payload.order_id[:12])
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The price on that order does not match any plan we sell. Nothing has "
                "been changed — please contact us with the receipt reference."
            ),
        )

    now = datetime.now(timezone.utc)
    if _mark_captured(db, payment, payload.payment_id, now):
        db.commit()
        log.info(
            "Payment %s captured for account %d (%s).",
            payload.payment_id[:12], user.id, payment.plan_code,
        )
    else:
        db.rollback()

    db.refresh(payment)
    return PaymentOut.model_validate(payment)


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Razorpay's server-to-server notice. Signature first, fields second.

    The body is checked as the exact bytes that arrived, before it is parsed, because
    re-encoding JSON changes it and a signature over different bytes is a permanent
    rejection that looks like an attack and is really a bug in the checker.

    What is *not* done with the payload: stored. Not one field of it is kept. A
    `payment.captured` entity carries the card's last four digits, its issuer and the
    cardholder's name, and none of that belongs in a database holding children's
    answers. Three values are read out of it — order id, payment id and amount — and
    the row it updates is the one this server created.
    """
    if not get_settings().razorpay_webhook_secret.strip():
        raise razorpay.NO_WEBHOOK_SECRET

    raw = await request.body()
    headers = {key.lower(): value for key, value in request.headers.items()}
    signature = str(headers.get("x-razorpay-signature") or "")
    if not razorpay.verify_webhook_signature(raw, signature):
        log.info("Rejected a Razorpay webhook delivery (signature did not match)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This delivery could not be verified.",
        )

    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This delivery could not be read.",
        ) from None

    kind = str(event.get("event") or "")
    entity = (
        event.get("payload", {}).get("payment", {}).get("entity", {})
        if isinstance(event.get("payload"), dict)
        else {}
    )
    order_id = entity.get("order_id")

    if kind not in (CAPTURED, FAILED) or not isinstance(order_id, str):
        # Answered with 200 on purpose. A 4xx here makes Razorpay retry an event we have
        # never wanted, and a queue of retries against a route that touches money is a
        # worse position than one logged "ignored".
        return {"received": True, "handled": "ignored", "event": kind or "unknown"}

    payment = _lockable_order(db, order_id)
    if payment is None:
        log.info("Razorpay reported an order this server never created")
        return {"received": True, "handled": "unknown-order"}

    payment_id = entity.get("id")
    amount = entity.get("amount")

    if kind == FAILED:
        if payment.status == "captured":
            return {"received": True, "handled": "already-captured"}
        reason = entity.get("error_description") or entity.get("code") or "declined"
        payment.status = "failed"
        payment.payment_id = payment_id if isinstance(payment_id, str) else None
        payment.failure_reason = str(reason)[:200]
        db.commit()
        return {"received": True, "handled": "failed"}

    # Captured. Three checks, all cheap, all of which have to hold before a paid
    # feature unlocks on an instruction from a third party.
    if not isinstance(payment_id, str) or not payment_id.startswith("pay_"):
        return {"received": True, "handled": "ignored", "reason": "no payment id"}
    if entity.get("status") != "captured":
        return {"received": True, "handled": "ignored", "reason": "entity not captured"}
    if not isinstance(amount, int) or amount != payment.amount_paise:
        log.warning(
            "Captured payment for order %s came in at %s, expected %s",
            order_id[:12], amount, payment.amount_paise,
        )
        return {"received": True, "handled": "amount-mismatch"}

    if _mark_captured(db, payment, payment_id, datetime.now(timezone.utc)):
        db.commit()
        log.info(
            "Webhook captured payment %s for account %d (%s).",
            payment_id[:12], payment.user_id, payment.plan_code,
        )
        return {"received": True, "handled": "captured"}
    return {"received": True, "handled": "already-captured"}


@router.post("/downgrade", response_model=PlanDetailOut)
@payment_limit
def downgrade(
    request: Request,
    payload: DowngradeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlanDetailOut:
    """Move the account back to Free immediately.

    There is no `cancel` here, and the billing screen says why: nothing in this build
    repeats a charge, so there is no recurring subscription to cancel — a paid period
    simply ends on its own. This route is the opposite decision, and it is the one that
    costs the family something: the rest of a period they already paid for is given up.
    That is why it needs an explicit confirmation flag rather than a button, and why the
    screen prints the number of days it will discard first.
    """
    if not payload.confirm_gives_up_remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Moving to Free now gives up the paid days still left on this account. "
                "Confirm that on the billing page to go ahead."
            ),
        )
    entitlements.set_plan(db, user.id, "free", source="free")
    db.commit()
    return PlanDetailOut.model_validate(entitlements.plan_detail(db, user))
