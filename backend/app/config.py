"""Application settings loaded from environment / .env."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# `psycopg` is the PostgreSQL driver in requirements.txt. A host that hands over a
# plain `postgresql://` URL (Vercel's database integrations do) would otherwise send
# SQLAlchemy looking for psycopg2, which is not installed here.
BARE_PG_SCHEMES = ("postgres://", "postgresql://")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "CareerGuide AI"
    database_url: str = "sqlite:///./careerguide.db"

    @field_validator("database_url")
    @classmethod
    def use_the_shipped_postgres_driver(cls, value: str) -> str:
        for scheme in BARE_PG_SCHEMES:
            if value.startswith(scheme):
                return "postgresql+psycopg://" + value[len(scheme) :]
        return value

    # Creating the tables and seeding the catalogue happens on the first boot.
    # Set DB_AUTO_SETUP=false once the database is prepared, so a serverless cold
    # start does not run schema DDL on every new instance.
    db_auto_setup: bool = True
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,http://careerguide.localhost:3000"
    )

    # AI provider. Leave ai_provider="demo" until real credentials exist.
    ai_provider: str = "demo"
    ai_api_key: str = ""
    ai_model: str = ""
    ai_base_url: str = "https://api.openai.com/v1"

    # Text-to-speech voices. Hindi and English. The same Microsoft neural voice
    # ids work on both transports below.
    tts_voice_hi: str = "hi-IN-SwaraNeural"
    tts_voice_en: str = "en-IN-NeerjaNeural"
    tts_timeout_seconds: int = 25

    # auto = the best configured service for this host, in the order below.
    # Microsoft's Edge read-aloud endpoint answers 403 to datacenter egress IPs, so
    # a deployment on serverless hosting needs gemini or azure. Forcing a provider
    # whose key is missing fails loudly instead of silently downgrading.
    tts_provider: str = "auto"
    azure_speech_key: str = ""
    # The Speech resource's own region, e.g. "eastus". The key only works there.
    azure_speech_region: str = ""

    gemini_api_key: str = ""
    gemini_tts_model: str = "gemini-3.8-flash-tts"
    # One voice carries Hindi, English and Hinglish: Gemini reads the script of the
    # text it is given. "Sulafat" is Google's warmest prebuilt voice.
    gemini_voice: str = "Sulafat"

    # A session lasts a day and is extended while it is in use (`security.renew_session`),
    # so this number never signs out a child who opens the app every evening — it decides
    # how long a token copied off a shared laptop is worth. It used to be 720, which made
    # every session on the site a month-long credential carrying a date it did not enforce.
    session_token_ttl_hours: int = 24
    # The ceiling rolling renewal cannot pass, measured from the sign-in that minted the
    # session. Without it "extended while in use" is a credential that never expires for
    # exactly the account that never stops being used, which is the thing a TTL exists to
    # prevent.
    session_absolute_ttl_hours: int = 720
    # Past the ceiling a token stops extending and its browser calls `/api/auth/guest` for a
    # new one, which costs a child nothing. So the ceiling bounds a copied bearer string, not
    # the person who owns the device.
    # A "day of quiet" is only a real promise if the browser keeps sending the credential
    # during the day, which is what the session cookie below and `POST /api/auth/refresh`
    # together are for.

    # --- The session cookie -------------------------------------------------------
    # A session reaches a browser as an `httpOnly` cookie, not as a string the page
    # stores: a value in `localStorage` is readable by any script served to that page, so
    # one cross-site-scripting bug anywhere in the frontend would be a way to collect
    # children's sessions. A cookie the browser sets and attaches itself is invisible to
    # page script. The bearer header still authenticates too — the scripts in `scripts/`,
    # the mail worker and any non-browser client use it, and a request that writes a
    # header out on purpose is answered from that header.
    auth_cookie_name: str = "cg_session"
    # `auto` decides from the request: `Secure` when this API was reached over https (or
    # over a proxy that said so in `X-Forwarded-Proto`), and on `localhost`, which browsers
    # treat as trustworthy so that a plain-http dev server can still hold the cookie.
    # `true` forces the flag for a deployment behind a proxy that does not set that header;
    # `false` is for a deliberately plain-http LAN instance, and it also forces SameSite off
    # `none` — a browser discards a `SameSite=None` cookie that is not `Secure`, so the two
    # are one decision, not two settings.
    auth_cookie_secure: str = "auto"
    # `none`, because the page and this API are different hosts in every deployment so far
    # (one origin serves the Next app, another serves FastAPI) and a cookie the browser will
    # not attach across them signs nobody in. Where the two ever share one origin, `lax` is
    # the narrower setting. See `cookie_samesite` in `app/security.py` for what happens when
    # `Secure` cannot be honoured.
    auth_cookie_samesite: str = "none"

    @field_validator("auth_cookie_secure")
    @classmethod
    def secure_mode_is_known(cls, value: str) -> str:
        mode = value.strip().lower()
        if mode not in {"auto", "true", "false"}:
            raise ValueError("AUTH_COOKIE_SECURE must be 'auto', 'true' or 'false'")
        return mode

    @field_validator("auth_cookie_samesite")
    @classmethod
    def samesite_is_real(cls, value: str) -> str:
        mode = value.strip().lower()
        if mode not in {"lax", "strict", "none"}:
            raise ValueError("AUTH_COOKIE_SAMESITE must be 'lax', 'strict' or 'none'")
        return mode

    # --- Rate limiting ----------------------------------------------------------
    # Every rule is a `limits` expression, so a deployment under a school's shared
    # network can be loosened without a code change. A rule that does not parse is
    # refused at startup rather than silently disabling the guard.
    rate_limit_enabled: bool = True
    # Every `GET` on an area a signed-in person is working in. Reading one's own rows is
    # the cheap half of the API, so this is a brake on a scraper that has got hold of a
    # session, not on a student: sixty a minute is a screen a second, and no keyboard
    # works that fast. The routes a page load or a server render depends on are exempt —
    # see `_READ_EXEMPT` in `app/middleware/rate_limit.py` for the list and why each entry
    # is there.
    rate_limit_read: str = "60 per minute"
    rate_limit_chat: str = "20 per minute"
    rate_limit_speak: str = "20 per minute"
    rate_limit_assessment: str = "10 per minute"
    # The questionnaires save each answer as it is given and the longest has 30
    # items, so the per-answer route gets room for a whole sitting plus a retry.
    rate_limit_answer: str = "40 per minute"
    rate_limit_auth: str = "5 per minute"
    # The guest lookup is how a device gets its own account back, so it runs on
    # every page load. Five a minute would lock a family out of their own work for
    # refreshing twice during a lesson; it is throttled, just not like a password.
    rate_limit_guest: str = "30 per minute"
    # Creating an order, verifying a checkout and switching plans. Six a minute is
    # room for a family whose card was declined to try again without waiting, and
    # still far from the rate at which anyone would enjoy hammering a route that
    # talks to a payment provider.
    rate_limit_payment: str = "6 per minute"
    # Attaching an address, confirming one, asking for a copy of a result and
    # inviting a guardian. Each of these makes a call to a paid email service on
    # somebody else's bill, and one of them lets a person name an address we have
    # never seen — so they get a tighter bucket than the routes that only read a
    # person's own rows.
    rate_limit_email: str = "10 per minute"
    # The study-abroad enquiry form. It is the only public POST in the app that stores
    # what a person typed, so the bucket is the caller's address rather than their
    # session. Ten an hour is the compromise: room enough for a school's counselling
    # office to send a class's enquiries in one afternoon, and slow enough that a bot
    # fills the table with noise rather than with names.
    rate_limit_lead: str = "10 per hour"
    # Only safe when a proxy that overwrites this header is the only way in.
    # Trusting it otherwise hands everyone a way to jump their own queue.
    rate_limit_trust_forwarded_for: bool = False
    # Inviting members into a school or a practice: each accepted row can end up
    # sending a mail to somebody who never asked for one.
    rate_limit_org_invite: str = "10 per minute"
    # Starting or changing a portal itself. Rarer than invites by an order of magnitude,
    # so the tighter bucket of the two.
    rate_limit_org: str = "5 per minute"
    # The operator's own mutations: granting the flag, closing an account, editing a
    # career entry, a question or an exam row. Only an already-authorised caller can reach
    # them, so this is not a defence against a stranger — it is a brake on a script, and on
    # a session whose token has been left open in a tab somewhere. Ten a minute is still
    # room to correct several catalogue rows in a sitting, and it is deliberately tighter
    # than the read bucket: an operator who wants to *change* sixty things a minute should
    # be using a script with its own auth, not a browser session.
    rate_limit_admin: str = "10 per minute"
    # Where the counters live. Blank — the default, and what every deployment so far
    # uses — means this process's own memory, which is honest for one instance and a
    # soft ceiling on serverless hosting (see `app/middleware/rate_limit.py`).
    #
    # Set it to a Redis URL (`redis://redis:6379/0`) when the API runs as more than one
    # worker or more than one container: without it, four workers mean four buckets, so
    # "20 per minute" quietly becomes 80 and a shared school IP gets a different answer
    # depending on which worker its next request lands on. This is the one place in the
    # app that talks to Redis, and the throttle is why — nothing here needs a queue or a
    # cache, and adding a service that no code connects to would be a dependency on air.
    rate_limit_redis_url: str = ""

    # --- School and counsellor portals -------------------------------------------
    # The domain a tenant portal hangs off: `green-school.<this>` is that school's own
    # address. `app/middleware/tenant.py` reads it and nothing else decides it, so a
    # deployment on another host changes one value rather than hunting for a hardcoded
    # domain. Locally, `*.careerguide.localhost` resolves without any DNS setup, which
    # is how the subdomain paths are testable before a wildcard record exists.
    tenant_base_domain: str = "careerguide.localhost"
    # The mirror of `RATELIMIT_TRUST_FORWARDED_FOR`, and unsafe for the same reason:
    # `X-Forwarded-Host` is a header any client can write, and believing it says "this
    # stranger is standing in the school's portal" is how one school's branding gets
    # painted onto another's screen. Set it to true only behind a proxy that overwrites
    # the header, which is exactly what Vercel and Render do.
    tenant_trust_forwarded_host: bool = False
    # How long an unaccepted invite stays open. A school's bulk list is a promise to a
    # family that somebody at that address was expected; a year later the class has
    # moved on, and a link that still works is a link that can still be forwarded.
    org_invite_valid_days: int = 21

    @field_validator(
        "rate_limit_read",
        "rate_limit_chat",
        "rate_limit_speak",
        "rate_limit_assessment",
        "rate_limit_answer",
        "rate_limit_auth",
        "rate_limit_guest",
        "rate_limit_payment",
        "rate_limit_email",
        "rate_limit_lead",
        "rate_limit_org_invite",
        "rate_limit_org",
        "rate_limit_admin",
    )
    @classmethod
    def rule_is_a_real_limit(cls, value: str) -> str:
        from limits import parse  # here, so the dependency stays only in the limiter

        try:
            parse(value)
        except ValueError as exc:
            raise ValueError(f"'{value}' is not a rate limit rule (try '20 per minute')") from exc
        return value

    # Clerk, as an *optional* upgrade to the device account. Every one of these is
    # blank by default, and with a blank the app behaves exactly as it always has:
    # one question, no sign-in, this browser is the account. The three endpoints
    # under /api/auth/clerk then answer 503 with a message naming what is missing,
    # rather than pretending an account was created.
    #   CLERK_SECRET_KEY            sk_test_… / sk_live_… — server-side only
    #   CLERK_API_BASE              change only for a self-hosted/custom-domain Clerk
    #   CLERK_WEBHOOK_SIGNING_SECRET  whsec_… — the webhook endpoint's own secret
    clerk_secret_key: str = ""
    clerk_api_base: str = "https://api.clerk.com"
    clerk_webhook_signing_secret: str = ""

    # --- Email ------------------------------------------------------------------
    # Resend, for the six messages in app/services/email.py. Both values are blank
    # by default and blank is a supported state, the same shape Clerk and Razorpay
    # use: with no key every send answers `not-configured`, the routes that could
    # have emailed say so on screen instead of showing a success nobody received,
    # and nothing in this app contacts Resend.
    #   RESEND_API_KEY             re_… from Resend -> API keys. Server-side only:
    #                              it can mail any address, so it never reaches a
    #                              bundle and is never pasted into chat.
    #   FROM_EMAIL                 the only address this service may use as sender.
    #                              A verified sender domain, e.g.
    #                              "CareerGuide AI <hello@careerguide.example>".
    #                              There is deliberately no per-call `from`: a
    #                              route that could pick its own sender is a way to
    #                              send a child's report to an address that is not
    #                              theirs while it looks like it came from us.
    resend_api_key: str = ""
    from_email: str = ""
    # Where a reply from a family should land. Blank means no Reply-To is set at
    # all, so a reply goes back to From — which is right until a real mailbox
    # exists, and wrong the moment the frontend's /api/contact gets one.
    email_reply_to: str = ""
    resend_api_base: str = "https://api.resend.com"
    email_timeout_seconds: int = 15

    # The outbox (app/services/email_jobs.py). A non-critical message is a row, and
    # a row that has failed this many times is left failed rather than retried
    # forever: a mailbox that refuses an address does not start accepting it on the
    # fifth try, and every retry is another request to a paid service.
    email_jobs_max_attempts: int = 4
    # Two days late, a progress digest is not a digest; it is a stale copy of a
    # child's work arriving out of nowhere. Such a row is dropped with a reason.
    email_stale_after_hours: int = 72
    # A weekly summary needs a clock, and a serverless deployment has none — there
    # is no process here between two requests. So a digest is created by the same
    # drain that sends it: whoever happens to arrive on this backend 7 days after
    # the last one gets the summary sent, which is why the interval is a setting
    # rather than a calendar week.
    email_digest_interval_days: int = 7

    # Where a study-abroad enquiry is announced. This is the site owner's own mailbox,
    # set once by whoever deploys this, and it is the only address in the whole app that
    # is not attached to an account.
    #   LEAD_NOTIFY_EMAIL          blank is a supported state: the enquiry is still
    #                              stored and still visible on the admin screen, and the
    #                              family still gets their acknowledgement if a key is
    #                              configured. Nothing about a missing value here loses a
    #                              message somebody asked for.
    # It is deliberately not readable from the admin screen: a route that could set the
    # address its own forms mail to is a way to turn a public form into a forwarding
    # service for any mailbox in the world.
    lead_notify_email: str = ""

    # --- Payments -----------------------------------------------------------------
    # Razorpay, so a family can pay for Pro. Everything about money on this server
    # is switched off by these two blanks, exactly the way Clerk is: with no key
    # the pricing page still renders its real prices, and the Upgrade button says
    # payments are not enabled on this deployment instead of opening a checkout
    # that cannot work. A route never invents a successful payment to look finished.
    #   RAZORPAY_KEY_ID            rzp_test_… or rzp_live_… — this one is also sent
    #                              to the browser, because Razorpay's checkout sheet
    #                              needs it. It identifies the account; it does not
    #                              authorise anything.
    #   RAZORPAY_KEY_SECRET        server-side only. Never in a bundle, never in a
    #                              commit, never pasted into chat. It signs orders
    #                              and proves callbacks came from Razorpay.
    #   RAZORPAY_WEBHOOK_SECRET    the webhook endpoint's own secret, shown in the
    #                              Razorpay dashboard when the endpoint is created.
    #                              Without it every delivery is refused, which is the
    #                              safe direction: an unsigned body would otherwise be
    #                              a way to grant a paid plan for nothing.
    # The test/live prefix of the key id is read back off the key rather than set by
    # hand, so a sandbox payment can never be mistaken for money later.
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_api_base: str = "https://api.razorpay.com/v1"

    # --- What the free plan is allowed --------------------------------------------
    # The limits the pricing page advertises. Enforcement is behind a flag that is
    # off by default, and that is a deliberate choice rather than an unfinished one:
    # every child using this app today has been told talking to the guide is free,
    # so turning a daily cap on is a decision for the day pricing goes live, not a
    # side effect of merging a branch. Flip PLAN_LIMITS_ENFORCED=true alongside real
    # keys, and check the prices in app/services/plans.py are the ones on screen.
    plan_limits_enforced: bool = False
    free_daily_chats: int = 3
    free_assessment_total: int = 1
    # A "day" for a student is an Indian day. Rolling the counter at UTC midnight
    # would hand a child back their three questions at 5:30 in the morning, before
    # they have slept.
    quota_utc_offset_minutes: int = 330

    # The two addresses a printed page has to carry: where the app lives and who to
    # write to about a wrong answer. A deployment on another host overrides them;
    # the defaults are the current public URLs, not a placeholder domain.
    public_site_url: str = "https://careerguide-web.vercel.app"
    public_repo_url: str = "https://github.com/anand07kuma-spec/careerguide-ai"

    @property
    def ai_configured(self) -> bool:
        return self.ai_provider.lower() != "demo" and bool(self.ai_api_key)

    @property
    def email_enabled(self) -> bool:
        """Both halves, or nothing. A key with no sender cannot mail; a sender with
        no key is a promise the transport cannot keep."""
        return bool(self.resend_api_key.strip() and self.from_email.strip())

    @property
    def razorpay_configured(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def razorpay_test_mode(self) -> bool:
        """True unless the key says live.

        A key id that is absent, odd or from another provider is treated as test,
        because the cost of guessing wrong is asymmetric: charging a family real
        money believing it is a sandbox is a refund fight, while calling a live
        payment a test only costs someone a confused billing screen.
        """
        return not self.razorpay_key_id.startswith("rzp_live_")

    @property
    def webhook_verifiable(self) -> bool:
        return bool(self.razorpay_webhook_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
