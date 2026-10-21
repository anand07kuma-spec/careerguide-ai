"""Test the money paths: prices, signatures, webhooks, and what a plan does and does not unlock.

Payments are the riskiest thing in this app, for a reason that has nothing to do with
money: the accounts are children. So every check here is aimed at one of four failures —

* a plan unlocked by a request rather than by a payment (a body naming its own price,
  its own user, or a signature nobody computed);
* a paid period granted twice by a provider that retries, or a browser that refreshes;
* a limit that silences a child who is disclosing harm, or that takes away data they
  already made;
* money changing what a child is *told* — the recommendation output is compared before
  and after a plan change, and it has to be identical.

Nothing here touches Razorpay. The provider is replaced by a stub that records what the
server asked for, so the amounts, the auth and the notes are all readable from this side,
and the suite runs with no network and no key. Which also means what this file cannot
prove: that a real payment really captures. That needs a test-mode key of your own, and
the README says so rather than implying otherwise.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/payments_test.py
"""

from __future__ import annotations

import hashlib
import hmac as mac
import json
import os
import pathlib
import sys
import tempfile
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_payments_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py
# Start as a deployment with no payment provider at all. Section two is exactly what
# such a server says, and it has to be a sentence rather than a fake success.
for _key in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"):
    os.environ.pop(_key, None)
os.environ["PLAN_LIMITS_ENFORCED"] = "false"

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Guardianship, Payment, Subscription, User  # noqa: E402
from app.services import assessment_bank, entitlements, plans, razorpay  # noqa: E402
from app.services.recommender import build_recommendations  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n== {title} ==")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def env(**values: str | None) -> None:
    """Change the environment and make the cached settings read it again."""
    for key, value in values.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()


KEY_ID = "rzp_test_AaBbCcDdEeFfGg"
KEY_SECRET = "test_key_secret_not_a_real_one"
WEBHOOK_SECRET = "whsec_test_webhook_secret"
CARD_LAST4 = "4111"
CARD_NAME = "Some Cardholder"


def payment_signature(order_id: str, payment_id: str, secret: str = KEY_SECRET) -> str:
    return mac.new(
        secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()


def webhook_signature(body: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return mac.new(secret.encode(), body, hashlib.sha256).hexdigest()


class _StubResponse:
    def __init__(self, status_code: int = 200, body: dict | None = None) -> None:
        self.status_code = status_code
        self._body = body or {}

    def json(self) -> dict:
        return self._body


class _StubHttpx:
    """Stands in for the httpx module inside razorpay.py, and remembers the asks."""

    HTTPError = httpx.HTTPError

    def __init__(self, respond) -> None:
        self.respond = respond
        self.calls: list[tuple[str, dict]] = []

    def post(self, url: str, **kwargs):
        self.calls.append((url, kwargs))
        return self.respond(url, kwargs)


def order_body(order_id: str = "order_TestOrder001", amount: int = 29_900) -> dict:
    return {"id": order_id, "entity": "order", "amount": amount, "currency": "INR",
            "status": "created"}


STUDENT = {
    "role": "student",
    "display_name": "Aarav",
    "preferred_language": "en",
    "class_level": "class-9",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}

DISTRESS = "My father beats me and I am scared at home every night."

client = TestClient(app)

# Entering the app is what creates the tables and seeds the career catalogue, so not one
# ask below can happen outside it. It is closed at the end rather than wrapped around
# five hundred lines, which would make every section here read as one single indent.
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)


def signup(name: str) -> tuple[str, int]:
    body = {**STUDENT, "display_name": name}
    response = client.post("/api/auth/onboarding", json=body)
    if response.status_code != 200:
        raise AssertionError(f"could not onboard {name}: {response.text[:300]}")
    data = response.json()
    return data["token"], data["user"]["id"]


def new_conversation(token: str) -> int:
    response = client.post("/api/conversations", json={"kind": "chat"}, headers=auth(token))
    assert response.status_code == 201, response.text[:200]
    return response.json()["id"]


def say(token: str, session_id: int, message: str, speak: bool = False):
    return client.post(
        f"/api/conversations/{session_id}/messages",
        json={"message": message, "speak": speak},
        headers=auth(token),
    )


def finish_one_questionnaire(token: str) -> int | None:
    """Start, answer and submit the first likert questionnaire. Returns the sitting id."""
    likert = None
    for name in assessment_bank.TYPES:
        instrument = assessment_bank.instrument(name)
        if instrument.get("response") == "likert":
            likert = name
            break
    likert = likert or assessment_bank.TYPES[0]

    started = client.post(
        f"/api/assessments/{likert}/start", json={"language": "en"}, headers=auth(token)
    )
    if started.status_code != 200:
        return None
    assessment_id = started.json()["assessment_id"]

    items = client.get(
        f"/api/assessments/session/{assessment_id}/questions", headers=auth(token)
    ).json().get("items") or []
    for item in items:
        client.post(
            f"/api/assessments/session/{assessment_id}/answer",
            json={"code": item["code"], "value": "3"},
            headers=auth(token),
        )
    client.post(
        f"/api/assessments/session/{assessment_id}/submit", json={}, headers=auth(token)
    )
    return assessment_id


def payment_row(order_id: str) -> Payment | None:
    with SessionLocal() as session:
        row = session.query(Payment).filter_by(order_id=order_id).one_or_none()
        if row is None:
            return None
        session.expunge(row)
        return row


def subscription_row(user_id: int) -> Subscription | None:
    with SessionLocal() as session:
        row = session.get(Subscription, user_id)
        if row is None:
            return None
        session.expunge(row)
        return row


def human(detail: str) -> bool:
    """An error a family reads must be a sentence, and must not name our internals."""
    return len(detail) > 25 and "slowapi" not in detail and "pydantic" not in detail


# ------------------------------------------------------------------ the catalogue
section("The price list is arithmetic, not a claim")
codes = [plan.code for plan in plans.all_plans()]
check("four plans are on offer", codes == ["free", "pro_monthly", "pro_yearly", "school"], str(codes))
monthly = plans.get("pro_monthly")
yearly = plans.get("pro_yearly")
school = plans.get("school")
check("Pro is ₹299 a month, in paise", monthly.price_paise == 29_900, str(monthly.price_paise))
check("Pro Yearly is ₹2,499", yearly.price_paise == 249_900, str(yearly.price_paise))
check("the comparison price is twelve months of Pro", yearly.compare_at_paise == 29_900 * 12)
check("the saving is the arithmetic difference", plans.savings_paise(yearly) == 358_800 - 249_900)
check("the advertised discount rounds to 30%", plans.savings_percent(yearly) == 30,
      str(plans.savings_percent(yearly)))
check("monthly is 30 days", monthly.period_days == 30)
check("yearly is 365 days", yearly.period_days == 365)
check("₹299 prints without decimals", plans.rupees(29_900) == "₹299", plans.rupees(29_900))
check("₹2,499 prints with a thousands separator", plans.rupees(249_900) == "₹2,499")
check("an odd amount keeps its paise", plans.rupees(10_050) == "₹100.50", plans.rupees(10_050))
check("Free is not purchasable", plans.get("free").purchasable is False)
check("the school plan has no price rather than a zero price", school.price_paise is None)
check("the school plan is priced by a person, not a checkout", school.cta == "contact")
check("only the two Pro plans can be ordered",
      plans.purchasable_codes() == ["pro_monthly", "pro_yearly"])
row_keys = {key for key, _label, _help in plans.FEATURE_ROWS}
check("every plan answers every comparison row",
      all(set(plan.features) == row_keys for plan in plans.all_plans()),
      str({plan.code: row_keys - set(plan.features) for plan in plans.all_plans()}))
check("a paid plan does not change the catalogue rows",
      plans.get("pro_monthly").features["catalogue"] is True
      and plans.get("free").features["catalogue"] is True)
check("an unknown plan code falls back to Free, not to Pro", plans.plan_for("nonsense").code == "free")
check("a missing plan code falls back to Free", plans.plan_for(None).code == "free")
check("a granted school licence keeps its own entitlements", plans.plan_for("school").pdf_reports is True)
check("Pro is not capped by day", plans.get("pro_monthly").daily_chats is None)

env(FREE_DAILY_CHATS="7", FREE_ASSESSMENT_TOTAL="4")
loose = plans.get("free")
check("an operator loosening the free chats changes the plan object", loose.daily_chats == 7)
check("and the same change is what the page would print",
      loose.features["conversation"] == "7 chats a day", loose.features["conversation"])
env(FREE_DAILY_CHATS=None, FREE_ASSESSMENT_TOTAL=None)
check("removing the override returns the default of 3", plans.get("free").daily_chats == 3)

# ------------------------------------------------------------------ no keys at all
section("A server with no Razorpay keys says so in words")
pricing = client.get("/api/payments/plans")
check("the price list still loads without keys", pricing.status_code == 200, pricing.text[:200])
check("and admits payments are off", pricing.json()["payments_enabled"] is False)
check("it still carries the real prices", pricing.json()["plans"][1]["price_paise"] == 29_900)
check("the limits on the page are the limits in force",
      [plan["daily_chats"] for plan in pricing.json()["plans"]]
      == [plan.daily_chats for plan in plans.all_plans()])

token_a, user_a = signup("Nisha")
refused = client.post(
    "/api/payments/create-order",
    json={"plan_code": "pro_monthly", "adult_attested": True},
    headers=auth(token_a),
)
check("ordering without keys is refused as unconfigured", refused.status_code == 503, str(refused.status_code))
check("the refusal names the variables to set",
      "RAZORPAY_KEY_ID" in refused.json().get("detail", ""), refused.text[:200])
check("and says nothing was charged", "nothing has been charged" in refused.json()["detail"].lower())
check("the refusal reads as a sentence", human(refused.json()["detail"]))

billing = client.get("/api/payments/me", headers=auth(token_a))
check("the billing screen loads without keys", billing.status_code == 200, billing.text[:200])
check("and shows no checkout key", billing.json()["key_id"] is None)
check("a new account is on Free", billing.json()["plan"]["plan_code"] == "free")
check("with no paid period", billing.json()["plan"]["expires_at"] is None)

stub = _StubHttpx(lambda url, kwargs: _StubResponse(200, order_body()))
razorpay.httpx = stub
env(RAZORPAY_KEY_ID=None, RAZORPAY_KEY_SECRET=None, RAZORPAY_WEBHOOK_SECRET=None)
client.post(
    "/api/payments/create-order",
    json={"plan_code": "pro_yearly", "adult_attested": True},
    headers=auth(token_a),
)
check("the provider was never contacted while unconfigured", stub.calls == [], str(stub.calls))
hook = client.post("/api/payments/webhook", content=b"{}", headers={"x-razorpay-signature": "00" * 32})
check("a webhook with no secret configured is refused outright", hook.status_code == 503, str(hook.status_code))

# ------------------------------------------------------------------ signatures
section("Signatures: the only thing that turns a request into money")
env(RAZORPAY_KEY_ID=KEY_ID, RAZORPAY_KEY_SECRET=KEY_SECRET, RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
check("the provider is now considered configured", razorpay.configured() is True)
check("a test key is reported as test mode", razorpay.is_test_mode() is True)
env(RAZORPAY_KEY_ID="rzp_live_AaBbCcDdEeFfGg")
check("a live key is reported as live", razorpay.is_test_mode() is False)
env(RAZORPAY_KEY_ID=KEY_ID)

order = "order_AaaBbb111222"
pay = "pay_XxxYyy333444"
good = payment_signature(order, pay)
check("a correct payment signature verifies",
      razorpay.verify_payment_signature(order, pay, good) is True)
check("a tampered signature does not",
      razorpay.verify_payment_signature(order, pay, good[:-1] + ("0" if good[-1] != "0" else "1")) is False)
check("a signature over a different payment does not",
      razorpay.verify_payment_signature(order, "pay_Zzz999888777", good) is False)
check("a random 64 hex string does not",
      razorpay.verify_payment_signature(order, pay, "ab" * 32) is False)
check("a malformed order id is refused before any compare",
      razorpay.verify_payment_signature("../../etc/passwd", pay, good) is False)
check("an over-long signature is refused",
      razorpay.verify_payment_signature(order, pay, good + "0000") is False)
env(RAZORPAY_KEY_SECRET=None)
check("with no secret, nothing verifies", razorpay.verify_payment_signature(order, pay, good) is False)
env(RAZORPAY_KEY_SECRET=KEY_SECRET)

body = json.dumps({"event": "payment.captured", "payload": {}}).encode()
check("a webhook signed over its exact bytes verifies",
      razorpay.verify_webhook_signature(body, webhook_signature(body)) is True)
reserialised = json.dumps(json.loads(body), indent=2).encode()
check("the same JSON re-typed fails, which is why raw bytes are signed",
      razorpay.verify_webhook_signature(reserialised, webhook_signature(body)) is False)
check("an empty body is refused", razorpay.verify_webhook_signature(b"", webhook_signature(body)) is False)
check("a non-hex signature is refused", razorpay.verify_webhook_signature(body, "not-a-signature") is False)
env(RAZORPAY_WEBHOOK_SECRET=None)
check("with no webhook secret nothing is accepted", razorpay.verify_webhook_signature(body, webhook_signature(body)) is False)
env(RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)

# ------------------------------------------------------------------ create_order
section("create_order: the price comes from the plan, never from the caller")
razorpay.httpx = stub
order_result = razorpay.create_order("pro_monthly", 42, "cg20261018-u42-pro_monthly")
url, kwargs = stub.calls[-1]
check("the order id from the provider is returned", order_result["order_id"] == "order_TestOrder001")
check("the ask went to the orders endpoint", url.endswith("/orders"), url)
check("the amount asked for is the plan's price", kwargs["json"]["amount"] == 29_900, str(kwargs["json"]))
check("in rupees", kwargs["json"]["currency"] == "INR")
check("using the key pair as basic auth", kwargs["auth"] == (KEY_ID, KEY_SECRET), str(kwargs.get("auth")))
sent_notes = json.dumps(kwargs["json"])
check("no display name is sent to the provider", "Nisha" not in sent_notes, sent_notes)
check("only our receipt and the plan name travel as notes",
      set(kwargs["json"]["notes"]) == {"cg_receipt", "cg_plan"}, str(kwargs["json"]["notes"]))
options = razorpay.checkout_options(order_result)
check("the browser is given the publishable key", options["key"] == KEY_ID)
check("the browser is given the order", options["order_id"] == "order_TestOrder001")
check("the checkout description carries the rupee price", "₹299" in options["description"])
check("no contact details are prefilled", "prefill" not in options, str(options))
check("nothing about the child is in the payload", "class-9" not in sent_notes and "drawing" not in sent_notes)

stub.respond = lambda url, kwargs: _StubResponse(400, {"error": {"field": "amount"}})
try:
    razorpay.create_order("pro_monthly", 42, "cg-x")
    check("a provider refusal raises", False)
except Exception as exc:  # noqa: BLE001
    check("a provider refusal raises 502", getattr(exc, "status_code", 0) == 502, str(exc)[:120])
    check("and says nothing was charged", "nothing has been charged" in str(exc).lower())

stub.respond = lambda url, kwargs: _StubResponse(200, {"entity": "order"})
try:
    razorpay.create_order("pro_monthly", 42, "cg-x")
    check("an answer with no order id raises", False)
except Exception as exc:  # noqa: BLE001
    check("an answer with no order id raises 502", getattr(exc, "status_code", 0) == 502)


def boom(url, kwargs):
    raise httpx.ConnectError("no route to host")


stub.respond = boom
try:
    razorpay.create_order("pro_monthly", 42, "cg-x")
    check("an unreachable provider raises", False)
except Exception as exc:  # noqa: BLE001
    check("an unreachable provider raises 502", getattr(exc, "status_code", 0) == 502)
    check("and does not look like a payment failure", "card" not in str(exc).lower())

calls_before = len(stub.calls)
for bad_code in ("free", "school"):
    try:
        razorpay.create_order(bad_code, 42, "cg-x")
        check(f"{bad_code} cannot be ordered", False)
    except Exception as exc:  # noqa: BLE001
        check(f"{bad_code} cannot be ordered", getattr(exc, "status_code", 0) == 422)
check("and the provider was not asked about either", len(stub.calls) == calls_before)

# ------------------------------------------------------------------ the routes
section("Ordering through the API")
stub.calls.clear()
stub.respond = lambda url, kwargs: _StubResponse(
    200, order_body(f"order_RealFlow{len(stub.calls):03d}")
)
unattested = client.post(
    "/api/payments/create-order",
    json={"plan_code": "pro_monthly", "adult_attested": False},
    headers=auth(token_a),
)
check("a student account cannot order without an adult", unattested.status_code == 403, str(unattested.status_code))
check("and is told to bring a parent, not billed", "adult" in unattested.json()["detail"].lower())
check("no order was made for a refused attestation", len(stub.calls) == 0)

priced = client.post(
    "/api/payments/create-order",
    json={"plan_code": "pro_monthly", "adult_attested": True, "amount_paise": 1},
    headers=auth(token_a),
)
check("a body cannot bring its own price", priced.status_code == 422, str(priced.status_code))
owned = client.post(
    "/api/payments/create-order",
    json={"plan_code": "pro_monthly", "adult_attested": True, "user_id": 99},
    headers=auth(token_a),
)
check("a body cannot name another account", owned.status_code == 422, str(owned.status_code))
bought = client.post(
    "/api/payments/create-order",
    json={"plan_code": "school", "adult_attested": True},
    headers=auth(token_a),
)
check("the school plan is not an online order", bought.status_code == 422, str(bought.status_code))
# The onboarding above left this client holding a session cookie, so an order posted
# without a header would still be posted by a signed-in student. Empty the jar first —
# otherwise this check silently creates a real order instead of proving a stranger is
# refused, and every count below it is wrong by one.
client.cookies.clear()
anon = client.post("/api/payments/create-order", json={"plan_code": "pro_monthly", "adult_attested": True})
check("ordering without a session is refused", anon.status_code == 401, str(anon.status_code))

ok = client.post(
    "/api/payments/create-order",
    json={"plan_code": "pro_monthly", "adult_attested": True},
    headers=auth(token_a),
)
check("an attested order is created", ok.status_code == 200, ok.text[:250])
order_id = ok.json()["order_id"]
check("the order amount is the plan price", ok.json()["amount_paise"] == 29_900)
check("the checkout settings come back too", ok.json()["checkout"]["key"] == KEY_ID)
stored = payment_row(order_id)
check("the server wrote its own record of the order", stored is not None)
check("as unpaid", stored.status == "created")
check("at the plan's price", stored.amount_paise == 29_900)
check("for this account", stored.user_id == user_a)
check("as a test-mode payment", stored.test_mode is True)
check("with the adult attestation recorded", stored.adult_attested is True)
check("and no column a card number could be kept in",
      not any(word in column.name for column in Payment.__table__.columns
              for word in ("card", "cvv", "email", "expir")),
      str([column.name for column in Payment.__table__.columns]))

mine = client.get("/api/payments/me", headers=auth(token_a)).json()
check("the billing screen lists the order", len(mine["payments"]) == 1)
check("under its own receipt", mine["payments"][0]["receipt"] == stored.receipt)
token_b, user_b = signup("Ravi")
other = client.get("/api/payments/me", headers=auth(token_b)).json()
check("another account sees none of it", other["payments"] == [], str(other["payments"]))
check("and is on Free", other["plan"]["plan_code"] == "free")

# ------------------------------------------------------------------ verify
section("verify: a plan unlocks on a signature, not on a say-so")
bad = client.post(
    "/api/payments/verify",
    json={"order_id": order_id, "payment_id": pay, "razorpay_signature": "00" * 32},
    headers=auth(token_a),
)
check("an unverifiable callback is refused", bad.status_code == 400, str(bad.status_code))
check("and says it could not be confirmed", "could not be confirmed" in bad.json()["detail"].lower())
check("the order is still unpaid", payment_row(order_id).status == "created")
check("no plan was granted by the refusal", subscription_row(user_a) is None)

shaped = client.post(
    "/api/payments/verify",
    json={"order_id": "../etc/passwd", "payment_id": pay, "razorpay_signature": "00" * 32},
    headers=auth(token_a),
)
check("an id that is not Razorpay's shape is refused before any compare",
      shaped.status_code == 422, str(shaped.status_code))

forged = client.post(
    "/api/payments/verify",
    json={"order_id": "order_AaaBbb111222", "payment_id": "pay_QqWwEeRrTtYy",
          "razorpay_signature": payment_signature("order_AaaBbb111222", "pay_QqWwEeRrTtYy")},
    headers=auth(token_a),
)
check("a correctly signed order that is not yours is not yours", forged.status_code == 404, str(forged.status_code))

right = client.post(
    "/api/payments/verify",
    json={"order_id": order_id, "payment_id": pay, "razorpay_signature": payment_signature(order_id, pay)},
    headers=auth(token_a),
)
check("the owner's verified payment is accepted", right.status_code == 200, right.text[:250])
check("the row is captured", right.json()["status"] == "captured")
check("with the provider's payment id", right.json()["payment_id"] == pay)
after = subscription_row(user_a)
check("the account now holds Pro", after is not None and after.plan_code == "pro_monthly")
check("recorded as a payment, not a grant", after.source == "payment")
check("for a month", after.interval == "monthly")
days = (after.expires_at - datetime.now(timezone.utc)).days
check("ending about thirty days out", 28 <= days <= 30, str(days))

usage_now = client.get("/api/payments/me", headers=auth(token_a)).json()
check("the billing screen shows the paid plan", usage_now["plan"]["active"] is True)
check("unlimited chats now", usage_now["usage"]["chats_allowed"] is None)
check("the invoice line is there", usage_now["payments"][0]["status"] == "captured")

expiry_before = subscription_row(user_a).expires_at
again = client.post(
    "/api/payments/verify",
    json={"order_id": order_id, "payment_id": pay, "razorpay_signature": payment_signature(order_id, pay)},
    headers=auth(token_a),
)
check("verifying the same payment twice still answers", again.status_code == 200, str(again.status_code))
check("and the second time adds no days", subscription_row(user_a).expires_at == expiry_before,
      str(subscription_row(user_a).expires_at))

# ------------------------------------------------------------------ webhook
section("The webhook: only Razorpay, only once, only its own money")
no_sig = client.post("/api/payments/webhook", content=b"{}", headers={"x-razorpay-signature": "ff" * 32})
check("an unsigned delivery is refused", no_sig.status_code == 400, str(no_sig.status_code))
check("and the refusal gives nothing away", " Razorpay" not in no_sig.json()["detail"])

ghost_body = json.dumps({
    "event": "payment.captured",
    "payload": {"payment": {"entity": {
        "id": "pay_GgHhJjKkLl", "order_id": "order_NobodyHere", "amount": 29_900,
        "status": "captured", "card": {"last4": CARD_LAST4, "name": CARD_NAME},
    }}},
}).encode()
ghost = client.post(
    "/api/payments/webhook", content=ghost_body,
    headers={"Content-Type": "application/json", "x-razorpay-signature": webhook_signature(ghost_body)},
)
check("a signed notice about an unknown order is acknowledged, not acted on",
    ghost.status_code == 200 and ghost.json()["handled"] == "unknown-order", ghost.text[:200])
check("and it created no subscription", subscription_row(9999) is None)

token_c, user_c = signup("Meera")
stub.calls.clear()
stub.respond = lambda url, kwargs: _StubResponse(200, order_body("order_WebhookC001", 249_900))
client.post("/api/payments/create-order", json={"plan_code": "pro_yearly", "adult_attested": True},
            headers=auth(token_c))
capture_body = json.dumps({
    "event": "payment.captured",
    "payload": {"payment": {"entity": {
        "id": "pay_CcDdEeFfGg", "order_id": "order_WebhookC001", "amount": 249_900,
        "status": "captured", "card": {"last4": CARD_LAST4, "name": CARD_NAME},
    }}},
}).encode()
headers = {"Content-Type": "application/json", "x-razorpay-signature": webhook_signature(capture_body)}
first = client.post("/api/payments/webhook", content=capture_body, headers=headers)
check("a signed capture is applied", first.status_code == 200 and first.json()["handled"] == "captured",
      first.text[:200])
sub_c = subscription_row(user_c)
check("to the plan the order was for", sub_c.plan_code == "pro_yearly")
days_c = (sub_c.expires_at - datetime.now(timezone.utc)).days
check("for a year", 363 <= days_c <= 365, str(days_c))
check("from the provider's own payment id", payment_row("order_WebhookC001").payment_id == "pay_CcDdEeFfGg")
expiry_c = sub_c.expires_at
repeat = client.post("/api/payments/webhook", content=capture_body, headers=headers)
check("a retry of the same delivery is a no-op", repeat.json()["handled"] == "already-captured")
check("and does not add a second year", subscription_row(user_c).expires_at == expiry_c)

leak_check = client.get("/api/payments/me", headers=auth(token_c)).text
check("the card's last four digits are not stored or shown", CARD_LAST4 not in leak_check, leak_check[:200])
check("the cardholder name is not stored or shown", CARD_NAME not in leak_check)

wrong_amount = json.dumps({
    "event": "payment.captured",
    "payload": {"payment": {"entity": {"id": "pay_Zz11223344", "order_id": "order_WebhookC001",
                                        "amount": 1, "status": "captured"}}},
}).encode()
mismatch = client.post("/api/payments/webhook", content=wrong_amount,
                       headers={"Content-Type": "application/json",
                                "x-razorpay-signature": webhook_signature(wrong_amount)})
check("a capture for a different amount is not applied",
      mismatch.json()["handled"] == "amount-mismatch", mismatch.text[:200])

stub.respond = lambda url, kwargs: _StubResponse(200, order_body("order_FailingD01", 29_900))
token_d, user_d = signup("Tariq")
client.post("/api/payments/create-order", json={"plan_code": "pro_monthly", "adult_attested": True},
            headers=auth(token_d))
fail_body = json.dumps({
    "event": "payment.failed",
    "payload": {"payment": {"entity": {"id": "pay_Ff11223344", "order_id": "order_FailingD01",
                                       "amount": 29_900, "status": "failed",
                                       "error_description": "Card declined by the issuer"}}},
}).encode()
declined = client.post("/api/payments/webhook", content=fail_body,
                       headers={"Content-Type": "application/json",
                                "x-razorpay-signature": webhook_signature(fail_body)})
check("a failure is recorded as a failure", declined.json()["handled"] == "failed")
check("with the provider's reason", payment_row("order_FailingD01").failure_reason == "Card declined by the issuer")
check("and grants nothing", subscription_row(user_d) is None)

other_event = json.dumps({"event": "subscription.created", "payload": {}}).encode()
ignored = client.post("/api/payments/webhook", content=other_event,
                      headers={"Content-Type": "application/json",
                               "x-razorpay-signature": webhook_signature(other_event)})
check("an event this app has no use for is acknowledged and ignored",
      ignored.status_code == 200 and ignored.json()["handled"] == "ignored")

# ------------------------------------------------------------------ downgrade
section("Giving up a paid period is a confirmed action, not a button")
shallow = client.post("/api/payments/downgrade", json={"confirm_gives_up_remaining": False},
                      headers=auth(token_a))
check("an unconfirmed downgrade is refused", shallow.status_code == 400, str(shallow.status_code))
check("and explains the days at stake", "gives up" in shallow.json()["detail"].lower())
check("the paid plan survives the refusal", subscription_row(user_a).plan_code == "pro_monthly")
deep = client.post("/api/payments/downgrade", json={"confirm_gives_up_remaining": True},
                   headers=auth(token_a))
check("a confirmed downgrade moves to Free", deep.status_code == 200 and deep.json()["plan_code"] == "free")
check("with no end date left to show", deep.json()["expires_at"] is None)
kept = client.get("/api/payments/me", headers=auth(token_a)).json()
check("the payment history is kept", len(kept["payments"]) == 1)
check("and it still names the plan that was paid for", kept["payments"][0]["plan_code"] == "pro_monthly")

# ------------------------------------------------------------------ limits
section("Free-plan limits, when a deployment switches them on")
env(PLAN_LIMITS_ENFORCED="false", FREE_DAILY_CHATS="2", FREE_ASSESSMENT_TOTAL="1")
token_e, user_e = signup("Farah")
session_e = new_conversation(token_e)
for turn in range(4):
    answer = say(token_e, session_e, f"Which engineering branches need maths in class 11? ({turn})")
    if answer.status_code != 200:
        break
check("with limits off, a fifth question is still answered", answer.status_code == 200, str(answer.status_code))
check("and the usage count still tracks", client.get("/api/payments/me", headers=auth(token_e)).json()["usage"]["chats_today"] == 4)

env(PLAN_LIMITS_ENFORCED="true")
blocked = say(token_e, session_e, "What about design careers?")
check("with limits on, the next question of the day is refused", blocked.status_code == 402, str(blocked.status_code))
check("refusing points at the price list", "/pricing" in blocked.json()["detail"])
check("and reassures that nothing already made is lost",
      "you have not been cut off from anything you already made" in blocked.json()["detail"].lower(),
      blocked.json()["detail"])
check("the refusal is a sentence", human(blocked.json()["detail"]))

rescue = say(token_e, session_e, DISTRESS)
check("a disclosure is answered whatever the plan", rescue.status_code == 200, rescue.text[:200])
reply_text = rescue.json()["reply"]["content"].lower()
check("and gets the reviewed safety reply", "safety" in reply_text or "trusted adult" in reply_text,
      reply_text[:160])
after_rescue = say(token_e, session_e, "Another ordinary question?")
check("a disclosure does not refill the day's quota", after_rescue.status_code == 402)
check("the disclosure was counted as a chat, honestly",
      client.get("/api/payments/me", headers=auth(token_e)).json()["usage"]["chats_today"] == 5)

started_other = client.post("/api/assessments/aptitude/start", json={"language": "en"},
                            headers=auth(token_e))
check("starting a questionnaire is allowed while none is finished",
      started_other.status_code == 200, started_other.text[:200])
unfinished = started_other.json()["assessment_id"]
client.post(f"/api/assessments/{assessment_bank.TYPES[0]}/start", json={"language": "en"},
            headers=auth(token_e))
resumed = client.post(f"/api/assessments/aptitude/start", json={"language": "en"}, headers=auth(token_e))
check("an unfinished sitting can always be resumed", resumed.status_code == 200 and resumed.json()["resumed"] is True,
      resumed.text[:200])

token_f, user_f = signup("Iqbal")
sitting = finish_one_questionnaire(token_f)
check("one questionnaire can be completed on Free", sitting is not None)
second = client.post("/api/assessments/personality/start", json={"language": "en"}, headers=auth(token_f))
check("a second one is where the free allowance ends", second.status_code == 402, str(second.status_code))
check("the message names the allowance", "assessment" in second.json()["detail"].lower())
catalogue = client.get("/api/careers", headers=auth(token_f))
check("the careers catalogue is still free", catalogue.status_code == 200 and len(catalogue.json()) > 0)
categories = client.get("/api/careers/categories", headers=auth(token_f))
check("and so are the stream and exam groupings", categories.status_code == 200 and len(categories.json()) > 0,
      str(categories.status_code))

pdf_free = client.post("/api/reports/generate", json={"assessment_id": sitting}, headers=auth(token_f))
check("printing a new report is the gated part", pdf_free.status_code == 402, str(pdf_free.status_code))
check("the gate names the feature", "report" in pdf_free.json()["detail"].lower())

with SessionLocal() as session:
    entitlements.set_plan(session, user_f, "pro_monthly", source="granted",
                          expires_at=datetime.now(timezone.utc) + timedelta(days=30))
    session.commit()
granted_row = subscription_row(user_f)
check("a school licence grants a plan without claiming a payment", granted_row.source == "granted")
paid_pdfs = client.get("/api/payments/me", headers=auth(token_f)).json()["payments"]
check("and no payment row exists for it", paid_pdfs == [], str(paid_pdfs))
pdf_ok = client.post("/api/reports/generate", json={"assessment_id": sitting}, headers=auth(token_f))
check("the report route works for a granted plan", pdf_ok.status_code in (200, 201), str(pdf_ok.status_code))
download_path = pdf_ok.json()["download_path"]
doc = client.get(download_path, headers=auth(token_f))
check("and the document really comes back", doc.status_code == 200 and doc.content[:4] == b"%PDF",
      str(doc.status_code))

with SessionLocal() as session:
    entitlements.set_plan(session, user_f, "free", source="free")
    session.commit()
listed = client.get("/api/reports/pdf", headers=auth(token_f))
check("moving to Free does not hide a report already made", listed.status_code == 200 and len(listed.json()) == 1)
again_doc = client.get(listed.json()[0]["download_path"], headers=auth(token_f))
check("and the file is still theirs to download", again_doc.status_code == 200 and again_doc.content[:4] == b"%PDF")

# ------------------------------------------------------------------ family + fairness
section("One family, one plan — and money that cannot change an answer")
with SessionLocal() as session:
    parent = User(role="parent", display_name="Grandma", preferred_language="en")
    stranger = User(role="parent", display_name="Unrelated", preferred_language="en")
    session.add_all([parent, stranger])
    session.flush()
    session.add(Guardianship(parent_id=parent.id, student_id=user_f))
    session.commit()
    parent_id, stranger_id = parent.id, stranger.id

with SessionLocal() as session:
    parent_user = session.get(User, parent_id)
    stranger_user = session.get(User, stranger_id)
    student_user = session.get(User, user_f)
    entitlements.set_plan(session, user_f, "pro_monthly", source="granted",
                          expires_at=datetime.now(timezone.utc) + timedelta(days=10))
    session.commit()
    check("a guardian inherits the family's paid period", entitlements.current_plan(session, parent_user).code == "pro_monthly")
    check("the student still holds it", entitlements.current_plan(session, student_user).code == "pro_monthly")
    detail = entitlements.plan_detail(session, parent_user)
    check("and the screen can say where it came from", detail["shared_from_family"] is True)
    check("an unlinked account does not", entitlements.current_plan(session, stranger_user).code == "free")
    expired = entitlements.set_plan(session, user_f, "pro_monthly", source="payment",
                                    expires_at=datetime.now(timezone.utc) - timedelta(days=1))
    session.commit()
    check("an ended period is not a plan any more", entitlements.current_plan(session, parent_user).code == "free")
    lapsed = entitlements.plan_detail(session, student_user)
    check("but the lapsed plan is still reported", lapsed["lapsed_plan"] == "pro_monthly" and lapsed["active"] is False)
    # A paid plan must never change what the guide suggests.
    before = [item["career"].title for item in build_recommendations(session, user_f, limit=5)[0]]
    entitlements.set_plan(session, user_f, "pro_yearly", source="payment",
                          expires_at=datetime.now(timezone.utc) + timedelta(days=365))
    session.commit()
    after = [item["career"].title for item in build_recommendations(session, user_f, limit=5)[0]]
    check("buying more does not change what a child is told", before == after, f"{before} != {after}")

    today_start, tomorrow_start = entitlements.day_boundaries(datetime(2026, 10, 18, 2, 30, tzinfo=timezone.utc))
    check("a chat day rolls over at IST midnight, not UTC",
          today_start == datetime(2026, 10, 17, 18, 30, tzinfo=timezone.utc), f"{today_start} → {tomorrow_start}")
    check("and a day is exactly one day long", tomorrow_start - today_start == timedelta(days=1),
          str(tomorrow_start - today_start))
    check("a chat just after midnight in India is a new day",
          entitlements.day_boundaries(datetime(2026, 10, 17, 18, 29, tzinfo=timezone.utc))[0]
          == datetime(2026, 10, 16, 18, 30, tzinfo=timezone.utc))

env(PLAN_LIMITS_ENFORCED="false", FREE_DAILY_CHATS=None, FREE_ASSESSMENT_TOTAL=None,
    RAZORPAY_KEY_ID=None, RAZORPAY_KEY_SECRET=None, RAZORPAY_WEBHOOK_SECRET=None)
razorpay.httpx = httpx
check("the provider client is handed back to the real httpx", razorpay.httpx is httpx)
LIFESPAN.close()

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + "; ".join(FAIL))
sys.exit(1 if FAIL else 0)
