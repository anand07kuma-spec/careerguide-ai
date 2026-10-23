# CareerGuide AI — Architecture & Tests

Deep technical documentation for CareerGuide AI: every setting, every screen, every test suite, and
every rule the code enforces. For a one-minute start, use the [root README](../README.md).

Career exploration for Indian students (class 6–12) and their parents. A student talks or types
with a guide in English, Hindi or Hinglish, explores careers, gets **exploratory** suggestions
(never a verdict), builds study plans, and decides what — if anything — a linked parent may see.

| Folder | What it is |
| --- | --- |
| `frontend/` | Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4 |
| `backend/` | FastAPI + SQLAlchemy: catalogue, conversations, AI provider, Gemini/Azure/Edge TTS, guest sessions, consent |

---

## 1. Run it locally

Two processes: API on **8000**, web on **3000**. Two terminals (Git Bash on Windows).

```bash
# terminal 1 — backend
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # macOS/Linux: pip install -r requirements.txt
./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open **http://careerguide.localhost:3000** (Chrome/Edge on Windows resolve it without editing
`hosts`) or **http://localhost:3000**. Both work, but the browser keeps its device id *per address*,
so opening the other one looks like a brand-new device — pick one and stay on it.

First backend start creates `backend/careerguide.db` and seeds the catalogue (55 careers,
64 resources, 31 scholarship leads, 32 institution entries). **No `.env` is needed** — every setting
has a working default. Replies are demo-generated and labelled as such until you add an AI key.

Check the API directly: http://127.0.0.1:8000/api/health · interactive docs: http://127.0.0.1:8000/docs

If port 3000 is taken, Next silently moves to 3001 (which then needs adding to `CORS_ORIGINS`).
Free it instead:

```bash
netstat -ano | grep LISTENING | grep ":3000 "   # PID is the last column
taskkill //PID <pid> //F
```

### Settings

Copy an example only when you want to change a default. Secrets stay on the server: never in
frontend code, never in a commit, never pasted into chat or a screenshot.

| Variable | Side | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | backend | `sqlite:///./careerguide.db` | Any SQLAlchemy URL. Postgres works as written |
| `DB_AUTO_SETUP` | backend | `true` | First boot creates tables and seeds. Set `false` once hosted |
| `CORS_ORIGINS` | backend | localhost:3000 | Browser origins allowed to call the API |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | backend | `demo` / empty / empty | Any OpenAI-compatible provider. `groq` is what this build is wired to |
| `AI_BASE_URL` | backend | `https://api.openai.com/v1` | Swap for a compatible gateway — Groq uses `https://api.groq.com/openai/v1` |
| `TTS_PROVIDER` | backend | `auto` | `auto` · `gemini` · `azure` · `edge` |
| `GEMINI_API_KEY` / `GEMINI_TTS_MODEL` / `GEMINI_VOICE` | backend | empty / `gemini-3.8-flash-tts` / `Sulafat` | The voice the app uses now; `auto` prefers it whenever a key exists |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` | backend | empty | Alternative server voice (see §3) |
| `TTS_VOICE_EN` / `TTS_VOICE_HI` | backend | `en-IN-NeerjaNeural` / `hi-IN-SwaraNeural` | Microsoft voice ids, used by the Azure and Edge routes |
| `TTS_TIMEOUT_SECONDS` | backend | `25` | Synthesis timeout |
| `SESSION_TOKEN_TTL_HOURS` | backend | `24` | How long a session lasts before it must renew itself; `auth_tokens` keeps `sha256(token)`, never the token |
| `SESSION_ABSOLUTE_TTL_HOURS` | backend | `720` | The ceiling rolling renewal cannot pass, counted from the sign-in that minted the session |
| `AUTH_COOKIE_NAME` | backend | `cg_session` | The one cookie this app writes. It carries the session, is `HttpOnly`, host-only and `Path=/`, and the browser attaches it to every API call (§7) |
| `AUTH_COOKIE_SECURE` | backend | `auto` | `auto` reads the request — `X-Forwarded-Proto: https`, otherwise the scheme, with `localhost` and `*.localhost` trusted — and decides whether the cookie is marked `Secure`. `true` and `false` force it. Where `Secure` cannot be honoured, `SameSite=None` is downgraded to `Lax` rather than sent in a form the browser discards |
| `AUTH_COOKIE_SAMESITE` | backend | `none` | `none` · `lax` · `strict`. `none` is what a page on one host calling an API on another needs, and it is only ever sent together with `Secure` |
| `RATE_LIMIT_ENABLED` | backend | `true` | One switch for every throttle below; `false` is what the functional suites run with |
| `RATE_LIMIT_CHAT` / `RATE_LIMIT_SPEAK` | backend | `20 per minute` each | Conversations and speech synthesis, per session |
| `RATE_LIMIT_ASSESSMENT` / `RATE_LIMIT_ANSWER` | backend | `10` / `40 per minute` | Starting and submitting a questionnaire, and the per-answer autosave — deliberately looser, see §6 |
| `RATE_LIMIT_AUTH` / `RATE_LIMIT_GUEST` | backend | `5` / `30 per minute` | Sign-in routes, and the device lookup that runs on every page load |
| `RATE_LIMIT_READ` | backend | `60 per minute` | One shared fixed window for the read routes, per session: the dashboard, the journey feed, the report list, saved careers, assessment history, the portals and `/api/admin/*` reads are counted together, because three limits of sixty are three chances to hammer the same database. The catalogue reads are **exempt** (`/api/exams`, `/api/careers`, `/api/scholarships`, `/api/resources`, `/api/study-abroad/*`, `/api/payments/plans`, `/api/voice/voices`) — a student who is only browsing must never see a list refuse to load — and neither is `/api/auth/me` or the portal lookup, because those run on every page load and would spend the budget on their own. `/api/exams/admin` is deliberately back inside the bucket, since that is where a stray loop would show up. A `429` here says what a child can read and carries `Retry-After`; nothing already loaded changes |
| `RATE_LIMIT_ADMIN` | backend | `10 per minute` | The operator's exam writes only — create, update and delete under `/api/exams`. It is the one screen that can change what every student reads, so the limit is the tight one, and the refusal is written so the operator knows the edits already made are stored rather than lost mid-form. Not a defence against an attacker: an attacker with those credentials can do worse than fill a form |
| `RATE_LIMIT_RESUME` | backend | `10 per minute` | The resume's ✨ suggester only (`POST /api/ai/resume-suggest`), because that is the one resume route that spends an outside call. Half the chat's rate: a student reads a list, thinks, presses again for a second idea, and a chat is a message every few seconds. Reading the CV rides on `RATE_LIMIT_READ` above like any other authenticated `GET`, and saving it gets no bucket of its own — it writes one row the student is already looking at. A `429` here says the ideas are coming faster than they can be made, that a minute is enough, and that whatever is already on the resume is saved |
| `RATE_LIMIT_ROADMAP` | backend | `6 per minute` | The result page's ✨ **Rewrite this plan with AI** only (`POST /api/assessments/result/{id}/roadmap`) — the other route that spends an outside call on something the app can write by itself. Tighter than the resume bucket on purpose: what it overwrites is a four-week plan a student may have already printed, so a few fast clicks should not spin the model three times while they decide. Reading a result needs no bucket of its own, because the plan arrives inside the result on the ordinary read rule. A `429` says plans are being asked for faster than they can be written, that a minute is enough, and that the plan already on the result is saved and unchanged |
| `RATE_LIMIT_INTERVIEW` | backend | `12 per minute` | `POST /api/ai/mock-interview` only — the practice interviewer, and the third route that spends an outside call on something the app can also do by itself. Looser than the resume and roadmap buckets because a five-question sitting is six calls in a row by design, and a student who thinks out loud between answers should not be told to wait; it is still a limit, and a sitting cannot be spent faster than a model can answer. A `429` here says the interview is going faster than it can be thought about, and nothing is lost by pausing: the questions and answers are in the tab, and closing it was always the other way out |
| `RATE_LIMIT_TRUST_FORWARDED_FOR` | backend | `false` | Count by `X-Forwarded-For` only behind a proxy you control; a caller-settable header is a way to jump the queue |
| `PUBLIC_SITE_URL` / `PUBLIC_REPO_URL` | backend | this site's own URLs | The two addresses a printed report carries, and the contact route a family can write to |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | `http://localhost:8000` | API origin the browser calls (baked at build time) |
| `BACKEND_INTERNAL_URL` | frontend (server only) | `http://api:8000` in compose, unset otherwise | API origin this app's **own server code** calls: `/careers`, `/blog`, the study-abroad pages and `sitemap.xml` all read the backend during render. Inside the web container `localhost` is the container itself, so without this the pages print "the catalogue service could not be reached" while the browser half of the same app works. Deliberately not `NEXT_PUBLIC_` — it is stripped from the client bundle |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | frontend | empty | `G-…`. A public property id, **not** a secret. Empty means no Google Analytics script is ever fetched, and the consent banner says "this site sets no cookies" instead of promising measurement. `middleware.ts` adds `googletagmanager.com` / `*.google-analytics.com` to the CSP only when it is set |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | frontend | empty | The Microsoft Clarity project id, same rule. Clarity replays a page's own elements, so it is switched off outright on `/app`, `/parent`, `/onboarding`, `/sign-in`, `/sign-up` and `/account` whatever the visitor answered — a replay of a student's screen would replay what they typed |
| `NEXT_PUBLIC_SITE_URL` | frontend | the deployed Vercel origin | Where canonicals, OpenGraph urls, `robots.txt`'s `Host` and the sitemap's absolute urls point. Set it to the real domain on the day one exists, or every canonical points somewhere nobody owns |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | frontend | empty | The Search Console placeholder. With no value, no `verification` meta tag is emitted at all; paste the token Google gives you and the root layout prints it. Both analytics ids and this one are public identifiers — nothing that lets anyone call your API |
| `NEXT_PUBLIC_LEGAL_COMPANY` + `_OFFICER` + `_EMAIL` + `_ADDRESS` + `_CITY` (+ optional `_PHONE`, `_REPLY_DAYS`) | frontend | sample values | The identity the legal pages print, read by `src/lib/legal-entity.ts` and by `/privacy`, `/contact`, `/terms` and `/about` through it — one edit at launch, not four. Unset, the pages show a demonstration set (`CareerGuide`, `grievance@careerguide.com`, `123 Tech Park, New Delhi, India`) beside a note that names them as samples; set all five and that note goes away by itself, and the root layout's `Organization` JSON-LD then adds the `legalName`, `PostalAddress` and `email` it withholds while they are samples. No value here is a secret — all of it is on public pages — and no officer's name or phone number is sampled at all: those rows are absent until an operator supplies a human and a line somebody answers |
| `RESEND_API_KEY` + `CONTACT_FROM_EMAIL` + `CONTACT_TO_EMAIL` | frontend | empty | All three, or `/api/contact` answers `503` and `/contact` says so on screen. Left unset here on purpose: there is no mailbox behind the form yet, and a success message nobody received is the one thing this page must never print |
| `CLERK_SECRET_KEY` | backend | empty | Only for the optional email sign-in (§4). Empty means the feature is off, and while it is off nothing in this app contacts Clerk |
| `CLERK_API_BASE` | backend | `https://api.clerk.com` | Where the backend verifies a browser token; change it only for a self-hosted Clerk or a custom domain |
| `CLERK_WEBHOOK_SIGNING_SECRET` | backend | empty | `whsec_…` for this endpoint alone — without it `POST /api/webhooks/clerk` refuses every request rather than trusting an unsigned body |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | frontend | empty | The browser half of the same feature. It is public by design; the secret half stays on the server |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | backend | empty / empty | The two halves of a checkout. With either blank, `POST /api/payments/create-order` answers `503`, `GET /api/payments/plans` reports `payments_enabled: false`, and `/pricing` disables its own Upgrade buttons instead of opening a sheet that cannot work. There is deliberately **no** `NEXT_PUBLIC_RAZORPAY_KEY_ID`: the publishable key reaches the browser inside the order response and `/api/payments/me`, so it is not baked into a bundle twice |
| `RAZORPAY_WEBHOOK_SECRET` | backend | empty | Without it `POST /api/payments/webhook` refuses every delivery rather than reading an unsigned body as an instruction to unlock a paid plan for nothing |
| `RAZORPAY_API_BASE` | backend | `https://api.razorpay.com/v1` | The real endpoint already; override it only to point a test at a stub |
| `PLAN_LIMITS_ENFORCED` | backend | `false` | The one switch for every cap. Off means the price list is published and nothing is turned away — a decision an operator makes on the day pricing goes live, not a side effect of merging the code that added the column |
| `FREE_DAILY_CHATS` / `FREE_ASSESSMENT_TOTAL` | backend | `3` / `1` | The free plan's numbers. `/pricing` renders them from the same objects the limiter reads, so the promise and the rule cannot be two different facts |
| `QUOTA_UTC_OFFSET_MINUTES` | backend | `330` | A chat day is an Indian day. Rolling it at UTC midnight would hand a child their questions back at 5:30 in the morning |

```bash
cp backend/.env.example backend/.env                  # gitignored
cp frontend/.env.example frontend/.env.local
```

### Database

SQLite is the default and needs nothing. For a hosted PostgreSQL, put the connection string in
`backend/.env` and restart. `app/config.py` adds the driver itself (`postgresql://…` →
`postgresql+psycopg://…`), so a copied string works unmodified.

**Supabase** — the SQL Editor route never hands your machine the password:

1. **Project Settings → Database → Connection string → URI**, with **Connection pooling** selected (the
   "Direct connection" host is firewalled to allow-listed IPv4). Both pooler modes work — `5432`
   session, `6543` transaction — because the engine recycles connections and skips server-side
   prepared statements.
2. URL-encode a password containing `@ : / %`; append `?sslmode=require`.
3. Tables: paste `backend/scripts/supabase_schema.sql` into **SQL Editor → Run**. It is generated from
   `app/models.py` by `scripts/make_supabase_schema.py` — regenerate after changing models.
4. Seed the catalogue and confirm what the app actually sees (dialect, server version, tables, row
   counts, password masked):

   ```bash
   cd backend
   ./.venv/Scripts/python.exe scripts/db_init.py     # seeds; rows carry Python-side defaults + JSON
   ./.venv/Scripts/python.exe scripts/db_check.py    # verify
   ```

Supabase republishes **every table in `public` over its REST API**, reachable with the `anon` key
alone. This app never uses that door — it talks to PostgreSQL through `psycopg` — so the generated SQL
ends by enabling row level security with no policies on all 19 tables. `anon` and `authenticated` then
read zero rows; the app keeps working because it logs in as `postgres`, the tables' owner, whom RLS
does not bind. The `service_role` key bypasses all of it: keep it on a server and rotate it if it has
ever been pasted somewhere public.

One trap: **SQLite accepts a string longer than a column's declared length, PostgreSQL rejects it.**
`scripts/schema_fit_check.py` measures every seeded value against its column and needs no database —
run it after touching the catalogue.

### Changing the schema (Alembic)

The app builds its own tables on first boot (`Base.metadata.create_all`) and adds a nullable column to
an existing table (`app/schema_sync.py`). Neither of those touches a column that already holds data, so
once a database has real answers in it, **Alembic is how the shape changes**:

```bash
cd backend
./.venv/Scripts/alembic.exe current                       # what this database thinks it is
./.venv/Scripts/alembic.exe upgrade head --sql            # print the SQL — read it first
./.venv/Scripts/alembic.exe upgrade head                  # then apply it
./.venv/Scripts/alembic.exe downgrade -1                  # undo the newest revision only
```

`DATABASE_URL` is read from the same `.env` the app uses, so there is no connection string in
`alembic.ini` to keep in step or to leak.

**Do not run `downgrade base` against a database holding real accounts.** `0000_baseline_schema`
creates `users` along with the other eighteen tables that predate the revision chain, so a full
undo drops the account table with everything else — it exists for tests that build a schema from
nothing and tear it down again, not for a deployment. Undo one revision at a time, and only after
`upgrade head --sql` has been read in the other direction.

The chain starts at `0000_baseline_schema`, which is the whole schema as it stood on 2026-10-17, and
`0001_assessment_tables` and the eight revisions after it are the deltas since. Before the baseline
existed, 0001 pointed its foreign keys at a `users` table it expected the app to have made with
`create_all` first — a precondition SQLite ignores and PostgreSQL refuses, which is why
`alembic upgrade head` on an empty Postgres used to fail with `relation "users" does not exist`
while working on a laptop. That whole problem is gone: **`upgrade head` on an empty database now
builds all thirty-seven tables and nothing else is required.**

A database the app prepared before migrations existed has no `alembic_version` table, so Alembic does
not know what it contains:

- tables **absent** → `alembic upgrade head`, and that is the end of it;
- tables **already there** (the app's first boot made them) → `alembic stamp head` first, which records
  the revision without running it. Skipping that step makes `upgrade` fail on `table already exists`.

For a new change: add the columns to `app/models.py`, then
`./.venv/Scripts/alembic.exe revision --autogenerate -m "what changed"`, **read the generated file**
(delete anything it invented for tables you did not mean to touch) and apply it with `upgrade head`.
Never edit `0000_baseline_schema` to match the models: it is a photograph of one day, and a later
revision that adds a column it already contains fails on every fresh database.
`scripts/migration_test.py` is the guard: it builds the schema three ways — the chain from an empty
database, the chain over a database that was already running, and the models — and compares all
thirty-nine tables on columns, types, nullability, foreign keys, `ON DELETE` actions, unique
constraints and index names, then checks the seed writes through the ORM, `downgrade` and `stamp`. Run
it after touching `migrations/`.

### Real AI model

The key lives in `backend/.env` (gitignored) and never reaches the browser:

```
AI_PROVIDER=groq
AI_API_KEY=<key, server-side only>
AI_MODEL=openai/gpt-oss-120b
AI_BASE_URL=https://api.groq.com/openai/v1
```

Restart uvicorn. `/api/health` then reports `demo_mode: false` and the "Demo guide answer" labels
disappear. Any OpenAI-compatible endpoint works the same way — only `AI_BASE_URL` and `AI_MODEL`
change.

One guard is worth knowing about: a reasoning model can spend the whole completion budget thinking
and come back with an empty answer. That counts as a provider failure, so the student sees the
built-in reply with the reason beside it instead of silence. (`openai/gpt-oss-20b` does this on Groq;
`gpt-oss-120b` was chosen because it answers in Hindi, English and Hinglish.)

---

## 2. Deploy to Vercel

Two projects from one repository.

| Project | Root Directory | Environment (Production scope) |
| --- | --- | --- |
| `careerguide-api` | `backend` | `DATABASE_URL` (Postgres — without it every data endpoint answers 503), `DB_AUTO_SETUP=false`, `CORS_ORIGINS=https://<frontend-origin>` |
| `careerguide-web` | `frontend` | `NEXT_PUBLIC_BACKEND_URL=https://<backend-origin>` (set before the build) |

**Root Directory is not optional.** A project that builds the repository root finds no
`package.json` and no `requirements.txt`, and Vercel's auto-detection guessed *Brunch* here — every
build died with `brunch: command not found`. Both projects are now Git-connected:

```bash
npx vercel git connect --project careerguide-api    # from the repository root
npx vercel git connect --project careerguide-web
```

A push to `main` deploys both. Preview deployments stay off real data on purpose: `DATABASE_URL`,
`CORS_ORIGINS` and `DB_AUTO_SETUP` are Production-only, so a preview boots with no database and
answers 503 (`scripts/serverless_guard_test.py` covers it). Do not add them to Preview.

`.vercelignore` in both directories keeps `*.db`, `.env`, `backend/media/` and `.venv/` out of the
upload — the database holds real conversations.

Order that works from scratch:

```bash
npx vercel login                                   # device-auth, you complete it in the browser
cd backend && npx vercel link --yes --project careerguide-api
npx vercel install prisma/prisma-postgres          # provisions a DB and writes DATABASE_URL
npx vercel env pull .env.local
npx vercel env add DB_AUTO_SETUP production        # answer: false
./.venv/Scripts/python.exe scripts/db_init.py --from-vercel
npx vercel env add CORS_ORIGINS production
npx vercel deploy --prod --yes
cd ../frontend && npx vercel link --yes --project careerguide-web
echo -n "https://<backend-origin>" | npx vercel env add NEXT_PUBLIC_BACKEND_URL production --type config
npx vercel deploy --prod --yes
```

`env add` without `--type config` stores a **Secret** — hidden in the dashboard, unreadable back,
which is what a database URL wants.

**Live now:** https://careerguide-api-omega.vercel.app (`/api/health` → `"storage": "ready"`) and
https://careerguide-web.vercel.app, both auto-deployed from
`github.com/anand07kuma-spec/careerguide-ai`.

Serverless changed three things in the code:

* **Audio is not a file.** `tts.synthesize()` returns a `data:audio/mpeg;base64,…` URL inside the
  reply. Nothing is written to disk or cached, so each play re-synthesises (~1–2 s) and a spoken
  reply costs ~30–70 KB of JSON. Pointing the browser at a path would put the reply's text into a
  logged URL.
* **Schema is prepared out of band** (`DB_AUTO_SETUP=false`); run `scripts/db_init.py` when the
  catalogue changes.
* **One function, 60 s ceiling** (`backend/vercel.json`, `maxDuration: 60`), region `bom1` (Mumbai),
  small pools (2 + 3 overflow) because every warm instance opens its own.

---

## 3. Voice

Three server transports, one chain: server audio → browser `speechSynthesis` → readable text.

| `TTS_PROVIDER` | Needs | Returns | Spoken length cap |
| --- | --- | --- | --- |
| `gemini` | `GEMINI_API_KEY` | `data:audio/wav;base64,…` (24 kHz mono) | 650 characters |
| `azure` | `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` | `data:audio/mpeg;base64,…` | 1200 characters |
| `edge` | nothing | `data:audio/mpeg;base64,…` | 1200 characters |
| `auto` (default) | — | picks the first configured one, in the order above | — |

What is spoken is the reply's first characters after markup is stripped, so a long answer is
shortened rather than rejected. WAV is about four times the bytes of mp3 for the same sentence, which
is why Gemini's cap is lower. Forcing a provider whose key is missing fails every spoken reply naming
the variable to set instead of quietly downgrading — a broken setup should look broken. No extra
dependency beyond `httpx` on any of the three paths.

**Gemini voices.** `gemini-3.8-flash-tts` reads whichever script it is handed, so one voice carries
Hindi, English and Hinglish; `GEMINI_VOICE` picks it (`Sulafat` is the default). Settings offers six
warm/friendly prebuilt options and the picker only ever lists voices the *active* service can use — a
Microsoft id cannot leak into a Gemini call, and a Gemini id cannot be sent to Azure.

Honest status: a real Gemini call has produced playable audio from this machine and **from the
deployed API too** — `https://careerguide-api-omega.vercel.app/api/health` currently answers
`"tts_provider": "google-gemini-tts"` with `"tts_last_attempt": {"ok": true}`, which is the proof, not
the dashboard setting. `checked_at: null` on that host would mean *nobody has asked it for audio*,
which is not the same as working.

One thing to know before pointing this at a long-lived database: **the deployed API does not run its
startup schema sync** — a serverless import never reaches that hook, so a column added to a model
after the database was created simply is not there, and the first request touching it answers `500`.
That is exactly how `POST /api/auth/guest` failed here on the day it shipped. Run
`scripts/db_init.py` against the deployment's own `DATABASE_URL` after every model change
(`npx vercel env pull .env.live --environment=production` to get it, then delete the file).

To check what the live site is really doing, ask it directly:

```bash
curl https://careerguide-api-omega.vercel.app/api/health
# "tts_provider": "google-gemini-tts", "tts_last_attempt": {"ok": true, …}
```

`ok: false` means `reason` holds the readable failure and the student is hearing the browser voice.
Settings → Language and voice shows the same answer, with a **Test the voice** button that asks the
server for a real clip.

The Azure route stays available for anyone who prefers the Microsoft neural voices:

1. portal.azure.com → Create a resource → **Speech** (not *Cognitive Services*), tier **F0**,
   region e.g. **Central India**.
2. Resource Management → **Keys and Endpoint** → copy **Key 1** and note the region string
   (`centralindia`). A key only works in its own region — a mismatch answers `401`.
3. `npx vercel env add AZURE_SPEECH_KEY production` then `AZURE_SPEECH_REGION`, and redeploy.

Cost and privacy:

* Gemini and Azure both receive the **text of the guide's reply** to turn into audio — never the
  student's microphone, which is transcribed in the browser. Settings says this out loud, and the
  same sentence is in `/api/voice/voices` → `note`.
* Azure F0 is free up to 500,000 characters/month (~3,000 spoken replies of 150 words), then stops
  until the next month. **On the free tier Microsoft may use submitted text to improve its service**
  (not on a paid tier).
* Edge TTS produces real audio from a home connection but answers `403` to datacenter egress IPs, so
  a deployed site without a key is expected to fall back to the browser's own voice — which the
  screen says. If sending replies to any speech vendor is unacceptable for children, keep the
  deployed site on that path: it needs no key and sends nothing.
* `scripts/tts_provider_test.py` covers all of this offline: SSML escaping of conversation text, the
  key travelling as a header rather than in a URL or the spoken body, `401`/empty/timeout messages
  that name neither the credential nor the reply, provider choice, and what `/api/health` reports.

---

## 4. Screens

| Route | Purpose |
| --- | --- |
| `/` | Landing, including "What CareerGuide AI will not do" |
| `/onboarding` | One question — student or parent — optional nickname, two consent confirmations. There is no account to create afterwards |
| `/welcome` | The first screen a device this server has never met lands on, instead of an empty dashboard whose every tile would 404 for a profile that does not exist yet. Two ways in — a conversation, or the self-discovery question sets — and each goes *into* `/onboarding` with its destination remembered (`?intent=chat`, `?intent=assessment`), so the one question and the two consent ticks still cannot be skipped. It mints nothing and asks for nothing: the device id was already made by the session provider on mount. A device that already has a session is redirected to `/app` or `/parent` |
| `/app` | Student dashboard: journey counts, directions worth exploring, saved careers, next step |
| `/app/call` | Voice call — 10 explicit states, captions, typed fallback, microphone only while listening |
| `/app/chat` | The same conversation by typing, with dictation and read-aloud |
| `/app/careers`, `/app/careers/[slug]` | Career explorer and full career detail |
| `/app/streams` | Class 10 → Science / Commerce / Humanities: what each stream is really like, other routes, five myths, and what to ask your own school. No recommendation, no score, no prediction |
| `/app/exams` | Entrance exams grouped by what you become through them (JEE, NEET, CUET, CLAT, CA, NDA, design, SSC/IBPS, state CETs). The list is the server's now — `GET /api/exams` fills the screen, and nothing about an exam is typed into the frontend bundle any more. No dates, fees, cutoffs or eligibility numbers anywhere, and that is a server rule rather than a design habit: a date or a fee is stored but **withheld** until an operator ticks the row as read from the official notification, and no seeded row is ticked, so the API could not publish a figure if a page asked for one. Each card names the official notification instead, plus a "how to check a notification is real" checklist |
| `/app/interests` | One gentle question at a time; answers become early signals, not a fixed profile |
| `/app/assessments`, `/app/assessments/[type]`, `/app/assessments/result/[id]` | Three questionnaires the student starts and finishes in their own time: **interest** (RIASEC, 30 statements), **personality** (Big Five short form, 20 statements) and **aptitude** (25 puzzles in numbers, words, reasoning and shapes). Each item exists in English and हिन्दी in `backend/data/assessment_questions.json`; the answer key never leaves the server. One question at a time, any order, every answer saved as it is clicked, so closing the tab costs nothing and "Continue where you left off" restores the exact sitting. Nothing is timed — a ticking clock turns a career questionnaire into an exam. The result page shows how much was actually answered before it shows any number, a radar chart with the same figures as a screen-reader table (and a bar list when too few areas are scored to draw one), each area with its band *and* its `answered of total` count, the careers in the app's own sample catalogue that the strongest areas point at, and a "what these numbers are not" block. A dimension with too few answers has no score at all and is printed as "No number yet" rather than 0. These are in-house self-questionnaires in the RIASEC and Big Five traditions, not licensed clinical instruments, and no screen calls them a diagnosis, an IQ score or a prediction. **A finished result also carries a next step**: a **Your skill gap** card and a **Your 30-day plan** timeline, both written from that sitting's own answers by `app/services/roadmap.py` and stored on the result itself (`roadmap_json`, migration `0015_result_roadmap`), so the plan arrives with the result instead of being generated each time the page opens. The gap says what the answers already cover and what the career those answers pointed at leans on beyond that — phrased as a property of *the work*, never of the child — and any area too thinly answered to score is printed in its own "Not measured, so not a weakness" block rather than as a 0. The plan is four weeks of short steps that need no money and no account, each one tied back to a named gap, plus a **Discuss this roadmap with AI Guide** button that opens `/app/chat?context=roadmap&result=N` with those same four weeks in front of the model — so "what is week two?" is answerable without the student describing it. **✨ Rewrite this plan with AI** asks the configured model for the same document in its own words, and the card then says who wrote it: *Written by the app's own rules* or *<provider> model*, which is the same line the resume screen holds itself to. A provider that is unreachable, unreadable or empty leaves the rules plan standing and prints one true sentence about the click that failed; the ✨ itself is not rendered when no model is configured at all. And because a model's sentences are the model's, a plan written in English stays in English when the interface switches to हिन्दी — the card says so with a *Written in English* badge rather than inventing a translation |
| `/app/journey` | Timeline of conversations, interests, saves and plans — counts, not scores |
| `/app/plans` | Student-owned study plans with per-step status |
| `/app/resume` | **"My Resume"**, in the sidebar under Your progress and on the dashboard. A one-page CV the student writes themselves: a read-only card with the name and class the account already holds (or "Not given yet"), one job title to aim at, class rows (class, school or board, year, and whatever the board calls the result — marks, percentage, grade, "appearing"), skills with an optional level, and projects with a line about what happened. `GET`/`POST /api/resume` hold it as one document on one account; saving replaces the whole document, so a row removed on screen is removed in the database too. **✨ Suggest** next to Skills and Projects calls `POST /api/ai/resume-suggest` with *only* the job title typed in the box, and the screen then says out loud which of its two sources answered — the configured model, or this app's own career catalogue when no provider is set, is unreachable, or returns something unreadable (`demo_generated`, and the career a fuzzy match landed on, shown beside the list so "cricket commentator" → "Professional Sport" is visible rather than presented as a fact about the child's future). A list labelled "AI suggested" when no model was consulted is the one thing this project will not print. **Download as PDF** is `window.print()` over a print-only layout — Tailwind `print:` variants, no `react-to-print`, no PDF library, no file on the server: the screen and the app's own header go hidden, the document the student wrote comes up on white paper with a footer naming the print date and stating that it was written by the student and not scored, verified or sent anywhere. Nothing here is scored, no recruiter receives anything, and the fields the brief listed as "Personal Info" deliberately do not collect a phone number, address, email or photo |
| `/interview-prep` | **Practice Interview**, a card on the student dashboard (`/app` → Places to go). A job is chosen from ten (`Doctor`, `Engineer`, `Designer`, `Teacher`, `Nurse`, `Lawyer`, `Pilot`, `Chef`, `Content creator`, `Data analyst`) or typed — "Something else — I will type it" opens a free-text box, because a student who wants to practise for *cricket commentator* should not be told that job does not exist. `POST /api/ai/mock-interview` takes `{role, history, language}` and returns one turn: a question, and — from the second turn on — a short note about the answer just given, printed between that answer and the next question. The cap is the server's, not the page's: `question_number` walks 1…5, the sixth answer closes the sitting, and a body that tries to talk past the limit (`max_questions`, a `system` speaker, a 16-line history) is refused `422` by `StrictIn` and `maxItems`. The end card shows the model's number out of 100 beside the sentence *This is one AI's opinion about five answers in one practice sitting. It is not a mark, it is not a measurement of you, and no college or employer ever sees it*, then its tips under **Tips to improve**. **Nothing about a sitting is stored** — no conversation row, no message row, no `demo_generated` audit row; `interview_test.py` counts every table before and after a whole sitting and then scans every row of every table for the sentences typed in it, which is also why account erasure reports nothing for an interview. A parent's session is refused `403` on the route and the screen is behind `RouteGuard access="student"`: practice with a guardian watching is a different thing, and the backend holds the line whatever the interface allows. When no model is configured the screen still runs — this app's own five questions, and *no feedback and no score*, because nobody read the answers; `feedback` and `score` come back `null` rather than as a compliment invented by a `for` loop. An answer that reads like a child asking for help closes the interview before it is scored, with the same fixed safety sentence the chat uses, and the model is not sent that turn at all. The Hindi dictionary holds this screen's copy *and* this app's own interview sentences, so a scripted sitting reads in हिन्दी; a model's sentence is never looked up in a dictionary, because there is no translation for a sentence nobody wrote down |
| `/app/reports` | Exploratory report, printable, with "what we still don't know" always shown |
| `/app/reports/[id]` | The printed PDF report for this account: an in-page preview of the file the server rendered, a Download button, and a Delete button that removes the stored bytes. Says plainly which language it was printed in, how big it is, when it was printed and how many questionnaires it holds. The document itself is drawn by ReportLab in `backend/app/services/pdf_report.py` — cover, per-questionnaire summary, RIASEC bars, Big Five bars, aptitude where it exists, careers worth a look, next steps, and a footer with the site and contact line — and it exists in English and हिन्दी. This is not a browser print of the screen: the numbers come from the stored answers, and the file lives in the database, not in a folder |
| `/app/resources` | Free learning resources |
| `/app/scholarships` | Financial-guidance leads + "how to check a scheme is real" checklist |
| `/app/institutes` | Sample directory; sponsored entries badged, order explicitly not a ranking |
| `/app/settings` | Six icon rows, each opening a panel: language & voice, profile, privacy & consent, family access, this device, about this build. Below them, a red-edged card that ends the account — see "Deleting an account is one step, and it is final" below |
| `/app/billing` | The money screen for the account this browser holds, reached from the sidebar under the family group (the person who holds the card is the parent-side account). Current plan with where it came from — bought here, granted as a licence, or free; a `shared_from_family` badge when it was inherited; the expiry date and days left when there is one, and a plain warning when the period has lapsed. **Renew**, **Choose a paid plan** and **Switch to the free plan** — the last opens a confirmation that lists what the *current* plan gives up (the printed report, the guardian view, today's chat and questionnaire counts) instead of a dead "Cancel subscription" button, because nothing here renews by itself. A "Used so far" card prints each counter against its allowance and says whether the allowance is even being enforced. A "Next payment" card states that there isn't one, by design. Then the payment list: amount, date, status with what that status means, receipt and payment ids, a test-mode marker, a failure reason, and the sentence that no card number, expiry, CVV or cardholder name exists anywhere on this site |
| `/parent` | Parent dashboard: summary not surveillance, guidance, access management |
| `/legal` | The front door to the five pages below: what each one answers, and a warning box saying what none of them claim |
| `/privacy`, `/terms`, `/refund`, `/disclaimer`, `/contact` | Public pages, no session needed, all five sharing one frame (`components/legal/legal-layout.tsx`) so their headers, contents lists, sibling links and print styles cannot drift apart. Each is a client page with a server `layout.tsx` beside it, because a client component cannot export `metadata` — that is where the `<title>`, description, `robots: index` and canonical live. `/privacy` is a 16-section policy describing the app that exists — device-id sessions, browser-only speech recognition, Groq and Gemini as the only AI recipients, SQLite locally and Vercel Postgres live, the application's own code setting no cookie while Google Analytics and Microsoft Clarity are named as the two services that can drop one (public pages only, consent only, and only where the operator configured them), and a Razorpay checkout that is built but has never taken money on this deployment — and where the app falls short of what a policy usually promises (no export, no one-button deletion, no retention clock, no verified provider data-retention terms) it says so; the grievance-officer block is the operator's own details — company, inbox, postal address, answer window — which every legal page reads from one module (`src/lib/legal-entity.ts`) instead of carrying its own copy. Its built-in values are **samples** until `NEXT_PUBLIC_LEGAL_*` is set at build time, and while they are still samples each card prints one quiet note saying exactly that, in place of the red badge that used to sit there. `/terms` (17 sections) refuses an indemnity clause and a forum-selection clause for the same reason. `/refund` now says what is actually true rather than what was true before the checkout existed: a Razorpay integration is built, has never taken a payment on this deployment, and has **no refund action inside the app** — no button, no route, no call to the provider's refund API — so a refund would be issued by hand from whoever holds the Razorpay account. The processing times it promises have never been measured, and the page says so. `/disclaimer` says the model is unchecked, the catalogue is sample data, and the build has had no legal review. None of them claims compliance with any law. `/contact` is a real form posting to `/api/contact` (see below) and shows the server's 503 on screen when no mail transport is configured |
| `/about` | Mission, how it works, the four things the project holds to (each with the gap under it), the team as an empty card, and what to read before a child uses it. Not a `LegalLayout` page — it has its own header and CTA |
| `/pricing` | Public, no session needed, and it builds with Clerk's and Razorpay's keys absent. Four cards from the server's own price list (`Free`, `Pro monthly ₹299`, `Pro yearly ₹2 499`, `School` with no price and a "Talk to us" call to action), a monthly/yearly toggle that only reorders — both prices stay on the page — a feature comparison table, four principles ("the advice does not change with the plan", "a card number never reaches this server", "an adult attests every time", "stop paying and nothing is taken away") and eight questions. Every number on it is read from `GET /api/payments/plans`, the same object the backend spends when it enforces a cap, so a promise and a limit cannot drift apart. Three flags decide what the page is allowed to look like: `payments_enabled` (no keys → the upgrade buttons are disabled and say "Upgrades are not open yet", plus a banner explaining the deployment cannot take money), `test_mode` (a live-keys-with-a-test-id warning), and `limits_enforced` (when false, a note that today every plan works free regardless). Pressing a real Upgrade without a session goes to `/onboarding` with a toast, because the device *is* the account and an order needs one to attach to. The checkout itself is `components/pricing/checkout-dialog.tsx`: an adult attestation first, then Razorpay's hosted sheet loaded on click from `src/lib/checkout.ts`, then the callback verified **server-side** before any plan changes — and a "the payment page said it worked but this server could not confirm it" state that is separate from a dismissed sheet |
| `/careers` | The public career catalogue — no session, no cookie, indexable. A server component because `/app/careers/*` is behind a device session and `robots.txt` disallows it, so a crawler needs a page it is allowed to read. Search and category filters are a plain `GET` form (`?search=&category=`), not buttons with no destination. It calls `GET /api/careers` and `GET /api/careers/categories` on the server, groups the results by category, and shows each career's summary, first three interest themes and the class it opens from. When the catalogue is empty it says so; when the backend did not answer it says *that* instead, with the status code — an outage and an empty country are different sentences. No salary, no placement, no "top 10" |
| `/careers/[slug]` | One public career profile: subject prerequisites, interest themes, the route people actually take, stages, and try-it-before-you-choose-it ideas, straight from the database row. `generateMetadata` builds the title, description and canonical from that row, and the page emits `EducationalOccupationalProgram` + `BreadcrumbList` JSON-LD with **no** `offers`, no salary and no program-type enum, because the catalogue does not have that data. A row flagged `needs_verification` carries a "Figures to verify" badge, official links are `rel="noopener noreferrer nofollow"`, and the foot states that the catalogue is sample data with no verified salary or placement figures. Unknown slug → `notFound()` + a noindex fallback title |
| `/blog` | The guide list, read off disk from `src/content/blog/*.md` (frontmatter parsed in `src/lib/blog.ts`, no CMS, no build plugin). Sorted by `updated` then `date`; each card shows the freshness label, the reading time at ~200 words a minute and the tags. Emits a `Blog` JSON-LD node. With no files in the directory the page renders an honest empty card instead of a fake list |
| `/blog/[slug]` | One guide, MDX through `next-mdx-remote/rsc` in a server component, with an element map so the prose picks up the design tokens (`ul` = `list-disc … marker:text-brand`, external links get `rel="noopener noreferrer nofollow"`). `generateMetadata` from the frontmatter, `type: "article"`, `Article` + `BreadcrumbList` JSON-LD, and a byline of "Published by CareerGuide AI" — the project wrote it, so no invented person is credited. Four guides are in the repo: choosing a career after class 10, the RIASEC questionnaire explained, how to read an entrance-exam notification, and a parent's guide to a career decision. None of them contains a statistic, fee, cutoff or deadline that was not verified, and each says it is written guidance rather than a verified source. `outputFileTracingIncludes` in `next.config.ts` is what keeps the `.md` files reachable in the serverless bundle |
| Search and sharing | `app/robots.ts` (allow all, disallow `/app`, `/api`, `/admin`, `/parent`, `/onboarding`, `/sign-in`, `/sign-up`, `/account`), `app/sitemap.ts` (the 11 public pages + every career profile + every guide, with `lastmod` from the blog frontmatter; the career list degrades to "no career URLs" rather than failing the build), `app/opengraph-image.tsx` (a 1200×630 `ImageResponse` card), one `pageMeta()` helper in `src/lib/site.ts` that writes the title, description, canonical, `robots`, OpenGraph and Twitter card for every public route, and `Organization` / `WebSite` (with a `SearchAction` pointing at `/careers?search={search_term_string}`) JSON-LD in the root layout. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is the Search Console placeholder: with no value set, no verification tag is emitted at all |
| Site chrome | `Footer` and `CookieBanner` are mounted once in `app/layout.tsx`, so every public page gets the same four-column footer (Product / Legal / Company / Social — a destination that does not exist is printed as text with the reason beside it, which today means the four social accounts) and the same storage notice. The footer links to `/careers` and `/blog` now that both are real pages. The footer is skipped on `/app`, `/parent` and `/onboarding`, which are full-height screens; because it reads `usePathname()` it is wrapped in `<Suspense>` — Next 16 will not prerender a client route that reads URL data |
| `/api/contact` | `POST` only (`GET` → 405). Validates name, email, one of four subjects and a 10–4 000 character message → `422` with per-field reasons; a filled honeypot is answered `200 {delivered: false}` so a bot learns nothing; missing `RESEND_API_KEY` / `CONTACT_FROM_EMAIL` / `CONTACT_TO_EMAIL` → `503 {error: "not_configured", missing: [...]}`; a failed send → `502`. The message body is never logged and never written to the database |


### Installable (PWA)

`public/manifest.webmanifest` (name, `/app` start url, `standalone`, `#0b1730` theme, 192 and 512 PNG
icons in both ordinary and `maskable` purposes — the maskable pair exists because Android crops a
plain icon to a circle and eats the "CG" wordmark — plus two home-screen shortcuts), linked from the
root layout with `<link rel="manifest">` and matched by `apple-touch-icon` and `theme-color`.

`public/sw.js` is a hand-written worker, not `next-pwa`. That plugin is webpack-only, and this
project builds with Turbopack and `cacheComponents`; bolting it on would have changed the bundling of
every screen to buy a file that could have been written in a hundred lines. It caches exactly two
things, in two caches: `/_next/static/**` (content-hashed file names, so a cached chunk can never be
the wrong chunk) and the five public assets (`/manifest.webmanifest` and the four icons). Everything
else — every page and every `/api` call — is `fetch(request, {cache: "no-store"})`: each screen here
is live data behind a per-device token, and an app that kept copies of a child's conversations on a
shared family phone would be handing them to whoever picked the device up next. That is why no page
document is ever put in a cache, and why a failed `/api` response is handed back to the screen as a
rejection instead of being papered over with HTML — every screen already answers a dead API with its
own honest message.

A navigation that cannot reach the server gets one thing: an inline fallback page, written into the
worker itself so it costs no request, saying that the page could not be reached and that nothing was
saved on the device while waiting, with one button — "Try again" — that reloads. It was verified by
stopping the container, loading `/app` (the fallback renders, the worker controls the page), starting
it again and pressing the button: the live screen came back.

The worker is registered by `src/components/sw-registration.tsx` in production builds only — in
`next dev` it would freeze pages against every edit. Offline support here means *the shell*, not the
data: a student on a train gets the app's own files, and the conversation resumes when the network
does.


### Profile facts, language

`services/profile_facts.py` gathers the rest of a profile inside the chat — `/onboarding` asks no
factual question at all.

* One missing fact at a time, where it matters: class and age early, where the student studies once a
  theme exists, cost only at practical next steps — and no fact is asked twice in a conversation. A
  class or age is stored only when the whole reply reads as an answer (≤7 words) or a sentence inside
  a longer reply states it about the student, so "mere papa class 12 mein the" and "class 3 hours of
  study" teach the profile nothing and a misread cannot silently steer a recommendation.
* Facts are stored as short fixed descriptions, not the child's sentences, and never overwrite a field
  that already has a value. The reply returns them as `profile_updates`; the bubble shows
  "Saved: Class 8". Unknown age is treated as the youngest band (6–8).
* `services/language.py` classifies every message as `en`, `hi` or `hinglish` (Devanagari ≥20% of
  letters → Hindi; romanised-Hindi words from a curated lexicon → Hinglish). If it differs from the
  session's language, the session switches and the TTS voice switches with it. Conversations open in
  the account's language, which defaults to Hinglish. Nothing is inferred from voice, accent or
  speaking speed.

There is a second, separate layer: the **interface** language. `frontend/src/lib/i18n.ts` stores
`en` or `hi` in `localStorage` under `careerguide.ui-lang`, and Settings → Language and voice offers
the switch. It is **never derived from the account**: a student who talks to the guide in Devanagari
used to find the whole interface in Hindi on the next load, which nobody chose, so that default was
removed on 2026-10-17. The interface opens in English and changes only when someone picks हिन्दी in
Settings on that device. English source text is the lookup key, so an untranslated string renders in
English rather than vanishing, and the server always renders English first (`useSyncExternalStore`
returns `"en"` until the client settles) so hydration cannot disagree with itself.
`document.documentElement.lang` follows the choice, because a screen reader given `lang="en"` reads
Devanagari out as gibberish.

Covered today: the sidebar and the mobile bottom bar, every screen heading and description, the
dashboard tiles and their detail dialogs, the streams screen, the exams screen, the career explorer
and career detail **including every career title**, the legal pages and `/about`, the site
footer, the storage notice and its preferences panel in full, the onboarding question with its
consent gate, the chat and call screens, the parent screen, the six operator screens, the resume screen
and the sheet it prints, the signed-in
gate every `/app/*` and `/parent` route passes through, the shared loading / empty / error /
badge labels those screens are built from, and the two cards a finished result now carries — the skill
gap and the four-week plan — plus the plan the chat pins above its first reply, which are translated
except for the sentences a model wrote — **2 138 keys** in `src/lib/hi/*` (measured 2026-10-23, after
the plan's two cards joined; 2 102 on 2026-10-22, after
the CV joined; 2 004 on 2026-10-21, when the three `Class 3` / `Class 4` / `Class 5` labels left with the
class range), one file
per area, merged by `src/lib/hi/index.ts`. `node scripts/hi-coverage.mjs` prints what is still missing from the strings a
page passes to `t()` directly; `node scripts/hi-prose-check.mjs <files>` catches the rest — the prose
that lives in a `SECTIONS` array or a `VALUES` list and is translated through a variable, which the
first script cannot see; `node scripts/hi-duplicates.mjs` watches the merge order, because the last
file wins and two dictionaries disagreeing about one label is a silent wording change elsewhere.

The primitives carry a good share of this so a screen cannot forget it: `Screen`, `CardHeader`, the
badges, the empty / error / loading states, `Modal`'s title and description, `Tabs` and `PillGroup`,
`Field` / `Input` / `Textarea` / `Select` (label, hint, error, placeholder and every option),
`Checkbox` / `Toggle`, the toast messages and `relativeTime()` all translate the plain English they
are handed. A caller passing `label="Phone (optional)"` is passing a key, not a string.

Still English-only: the billing, settings, plans, reports, resources, scholarships, institutes,
journey and interests screens, `/pricing`, the portal and pricing components, the study-abroad lead
form and country pages, the operator's exams screen, six section headings on `/refund` and one line on
`/terms` —
**425** of the 1 486 strings `hi-coverage.mjs` finds across the whole app (both counted 2026-10-20) —
and, on any screen, prose the **server** writes, like a
recommendation's "why this one" note or a report's closing line. Dictation also still has no Hinglish
locale (`hi-IN` / `en-IN`).

### There is no login: this prototype recognises the device

No email, no phone, no password, no sign-up screen — `/login` is gone, and nothing in the app asks a
student to sign in to use it. `frontend/src/lib/device.ts` makes a random id on first visit
(`crypto.randomUUID()`, or a `getRandomValues` hex fallback) and keeps it in this browser's
`localStorage` under `careerguide.device-id`. On a later visit the browser offers its session cookie
first (`GET /api/auth/me`), and only where the browser kept no cookie does
`POST /api/auth/guest {device_id}` ask one question — *has this device been here before?* — and
answers `known: true` with a fresh session (the cookie, plus the string this app holds in memory for
the browsers that will not take one), or `known: false` so the route guard sends the visitor to the
single opening question.

Settings → **Account** does offer one more thing: an *optional* email sign-in that can be attached to
the account this browser already holds. It is off until an operator adds keys, and how it works — and
what has not been proved about it — is the next section.

Two things make that safe rather than lazy:

* The device id is a **lookup, not a credential**. It is never trusted on its own after the first
  frame: every data request is still signed by the session this server issued — its `httpOnly` cookie,
  or that same session in a header — and the ownership checks in §6 run against it. Guessing somebody
  else's id does not read their conversation, and the id is only ever stored as a digest.
* `users.device_id` is unique-ish by construction: a second onboarding for a device the server
  already knows is a `409`, not a silent second student on the same row.

Settings → **This device** explains it in the student's words and offers **Start over**, which
rotates the id. Rotating matters: revoking the token alone would leave the id recognised, and the
same student would quietly come back on the next page load.

**The honest limitation.** Progress belongs to one browser on one device. Clearing this site's data,
using a private window, or switching phone starts a fresh student and there is nothing to recover the
old one with — and anyone sitting at this browser can continue the conversation. Fine for a prototype
demoed on your own machine; **not a shape to hand to real children**.

The old account model has not been deleted from the server — `/api/auth/login` and the come-back-code
endpoints still work and `scripts/login_test.py` still proves their hashing and anti-enumeration
behaviour. Only the screens that offered them are gone, so adding a real sign-in later is a UI task,
not a rewrite.

Deploying this onto an existing database needs the new nullable columns (`create_all` never alters a
table): `scripts/db_init.py` adds missing nullable columns and their index — `users.device_id`
arrives this way, as it did on first boot here — and drops or rewrites nothing unless
`--recreate-if-empty` is passed while every table is still empty.

### Deleting an account is one step, and it is final

Settings ends with a red-edged card, **Delete account**, and it is the only screen that calls
`DELETE /api/users/me` (`backend/app/routers/users.py`). It sits at the bottom rather than in a panel
because there is no password and no confirmation email behind it: this account was never made from either,
so the session is the whole authority for the most destructive call in the app. That is why the dialog
lists what goes and what stays before anything can be pressed, and why the route is idempotent in the only
direction that matters — a second call cannot repeat the erasure, because the account's tokens are already
gone.

What goes is checked rather than assumed. `scripts/erasure_test.py` writes one row into everything the
route names — a conversation with three messages, an assessment with its answer and its result — the
skill gap and the four-week plan live in that result row's own column, so they leave with it and not in a
second table — a career
report, the PDF printed from it, a plan with an item, saved careers, a recommendation, journey and interest
rows, settings, a consent, a queued mail and a resume — then compares every per-table number in the response against
what the database actually held, and re-counts each table to zero afterwards. The child rows are counted
separately on purpose (messages under their conversation, answers and results under their sitting, plan
items under their plan), because that is where an erasure quietly fails: SQLite carries the
`ON DELETE CASCADE` in the schema and does not switch it on, so a route that relies on the cascade leaves
half a person's record behind. This is how the suite found the plan items, and the route deletes them itself
now. Every session on every device ends, the cookie is cleared, and the device id stops resolving — so the
next visit from that browser is a stranger rather than a way back in.

What stays is three things, and the dialog says so in the route's own words (`KEPT`): the payment and
refund ledger, the operator log — with this erasure written into it and the erased person's name taken off
that entry — and the row that used to be the account, now holding nothing but `erased_at`. Deleting the row
would cascade the ledger and the log with it, and a money record that the payer can delete is not a money
record. Nobody else is taken down alongside them: a parent's erasure removes both guardianship links and
leaves each child's account, conversation, profile and working session; a student's erasure inside a
counsellor's portal removes their seat and the note written about them, and leaves the counsellor's account
and every other client. An **operator account is refused** (`403`) — closing the one account that can change
the whole site has to be done by another operator, so the log keeps saying who stopped being able to change
things.

**An erasure is not a restore, and it is not a legal claim.** The app keeps no copy to bring rows back
from, and the privacy page's "Deletion" right is now `In the app` rather than `Partly built` because of
this route. The dump `backend/scripts/backup_db.sh` writes (§1) does hold what was deleted, which is a
retention decision whoever runs the site makes — a button cannot make it for them, and the sentence in
`app/routers/users.py`'s own docstring says exactly that rather than citing DPDP.

### The optional upgrade: an email sign-in, run by Clerk

The device account above does not change. Connecting an email **labels the account this browser
already holds**, so the same conversations, saved careers and plans can also be opened by signing in
from another browser. It does not create a second profile, does not move or copy any row, and does
not hand Clerk anything except the id it is given. While the keys below are absent, the app never
talks to Clerk at all: `/account/connect` prints "not switched on for this site" instead of rendering
a widget, and Settings → Account says the same thing in the student's words.

| Piece | File | What it does |
| --- | --- | --- |
| Two screens | `frontend/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `.../sign-up/[[...sign-up]]/page.tsx` | Clerk's own `<SignIn>` / `<SignUp>`, hash routing, and `fallbackRedirectUrl` pointing at the screen that finishes the job |
| Middleware | `frontend/src/middleware.ts` | `clerkMiddleware()` on the four Clerk routes only. It deliberately does **not** gate `/app/*`: this app's account is the session the browser keeps for itself — an `httpOnly` cookie, and in a few browsers only a bearer string held in memory — neither of which a middleware can see, so gating on Clerk would lock every student out of their own work |
| Connect | `frontend/src/app/account/connect/page.tsx` | Waits for the local session to settle, asks Clerk for a token, then `POST /api/auth/clerk/link`. No token, no request — the page explains that there is no work to attach an email to yet |
| Come back | `frontend/src/app/account/enter/page.tsx` | Signed in with the email → the backend finds the account that email was attached to and issues a session token for it |
| Backend | `backend/app/services/clerk.py` + `backend/app/routers/clerk.py` | `GET /api/auth/clerk` (status), `POST /link`, `POST /enter`, `DELETE /link`. Verification is `POST {CLERK_API_BASE}/v1/tokens/verify` with the secret key; unlink clears only the two columns |
| Webhook | `backend/app/routers/clerk_webhooks.py` → `POST /api/webhooks/clerk` | Svix-signature-checked `user.deleted` handler, so a deleted Clerk account loses its link here |
| Two columns | `migrations/versions/0003_clerk_link.py` | `users.clerk_user_id` (unique index `ix_users_clerk_user_id`) and `clerk_linked_at`. That is the whole payload — no email address, no name, no Clerk profile fields |

To switch it on:

1. Make a Clerk application and copy its test keys.
2. `backend/.env` → `CLERK_SECRET_KEY=sk_test_…`. Leave `CLERK_API_BASE` alone unless Clerk is
   self-hosted.
3. `frontend/.env.local` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…`. This one is baked at build
   time, so restart `npm run dev` (or rebuild) after setting it.
4. Clerk Dashboard → Webhooks → add `https://<your-backend>/api/webhooks/clerk` listening for
   `user.deleted`, then copy that endpoint's own `whsec_…` into `CLERK_WEBHOOK_SIGNING_SECRET`.
   Locally that URL has to be a tunnel to `:8000`; without the secret the route answers
   `403` to everything, which is the intended failure, not a bug.
5. `./.venv/Scripts/python.exe -m alembic upgrade head` (or `scripts/db_init.py`) so the two columns
   and their index exist before the first link attempt.
6. Then: onboarding → Settings → Account → *Connect an email* → sign up with a throwaway address →
   the connect screen reports the link → open `/account/enter` in a private window and sign in with
   that address, and the same student's work appears → Settings → Account → *Disconnect the email*.

**What has not been proved.** Steps 1–6 above have never been run against a real Clerk project, so
the live widget, a real `/v1/tokens/verify` round trip and a genuine Svix-signed webhook are
**unverified** in this build. The 105 checks in `clerk_auth_test.py` talk to a stand-in HTTP server
that answers the way Clerk's API is documented to answer; they prove this app's own logic — token in,
link written, authorisation checked, unlink, webhook signature and `user.deleted` — and they prove
nothing about Clerk's service. The disabled state *is* verified in a real browser: no provider
contacted, honest copy, no dead buttons.

And one thing to keep in front of whoever deploys this: a child's email address is personal data about
a minor. Switching this on moves the app further into ground that needs qualified legal review —
§6's rule still holds that the email proves nothing on its own and grants nothing, but that is an
engineering property, not a compliance claim.

### Taking money: a Razorpay checkout that is built and switched off

Four plans, one payment provider, and a deployment that has never charged anyone.

| Piece | Where | What it is |
| --- | --- | --- |
| Plan catalogue | `backend/app/services/plans.py` | `free`, `pro_monthly` ₹299, `pro_yearly` ₹2 499, `school` with no price. Prices live in paise, one integer, no float and no currency arithmetic. Yearly's savings are **computed** from monthly × 12, never typed in, so the discount cannot drift from the price it is a discount on |
| Provider client | `backend/app/services/razorpay.py` | `httpx` against `Razorpay`'s order endpoint with the key pair as Basic auth and a timeout. Not the `razorpay` npm package, and not the Python SDK — see below |
| Entitlement engine | `backend/app/services/entitlements.py` | `current_plan()` resolves what an account may do right now, reading a guardian's paid period for a student in that family; `guard_chat`, `guard_assessment_start` and `guard_feature` are the three places a limit is actually applied |
| Routes | `backend/app/routers/payments.py` | `GET /api/payments/plans` (public), `GET /api/payments/me`, `POST /api/payments/create-order`, `POST /api/payments/verify`, `POST /api/payments/webhook`, `POST /api/payments/downgrade` |
| Checkout | `frontend/src/lib/checkout.ts` + `components/pricing/checkout-dialog.tsx` | Razorpay's hosted sheet, loaded on click, never on page load |

**Why there is no payment package installed on either side.** The `razorpay` npm package is the *server*
SDK: it wants the key secret, and putting it in a Next.js bundle would put a credential in a file every
visitor can download. The Python `razorpay` package does the same job the eleven-line `httpx` call in
`services/razorpay.py` does, with a larger surface to keep updated. So the browser gets only what
`checkout.js` needs — an order id, an amount, a currency and the publishable key, handed to it by
`POST /api/payments/create-order` for one use — and the card itself is typed into Razorpay's document,
served by them, inside a frame this site cannot read. That is why `GET /api/payments/plans` reports
`payments_enabled` rather than the frontend knowing anything about keys.

**The four rules that make this safe enough to sit next to children's answers.**

1. **A number in a request is never a price.** `create-order` takes a plan *code* and looks the amount up
   in the catalogue; a body that carries its own `amount` fails validation, because an extra key is
   refused here like everywhere else.
2. **An adult says so, every time.** The dialog will not start an order until the box is ticked, and the
   server refuses the order without that attestation — so it is not a checkbox that can be removed from
   the DOM. Nothing is prefilled from the student's profile: no name, no email, no device nickname
   reaches a payment form.
3. **A plan unlocks on a signature, not on a say-so.** `POST /api/payments/verify` recomputes the
   HMAC over the order id and payment id with the key secret before writing anything, and the webhook is
   the same check from the other direction. `payments.order_id` is unique and `subscriptions.user_id` is
   the primary key, so a provider that retries lands on a row that already exists instead of buying a
   second month.
4. **Money cannot change an answer.** The careers, streams and exams a student sees are the same
   documents on every plan, and `payments_test.py` compares the recommendation output before and after a
   plan changes. A paid period buys volume, repeat questionnaires, the printed report and a guardian's
   view — and `source` distinguishes "payment" (money moved) from "granted" (a school licence), so the
   billing screen never claims a family paid when nobody did.

**What is deliberately not built.** No automatic renewal, so there is nothing to cancel and no
card-on-file to be caught by; no in-app refund action, which means a refund is a human in the Razorpay
dashboard; no coupon codes, no seat-counting for the school plan, no invoice PDFs; and no plan beyond
those four. `/app/billing` says "there is no next payment, and that is the design" instead of showing an
empty field.

**To switch it on.** Put `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the backend environment (a
`rzp_test_…` key id makes the app say so on screen; a `rzp_live_…` one makes it stop saying it), set
`RAZORPAY_WEBHOOK_SECRET`, and create the webhook in Razorpay's dashboard for
`https://<backend origin>/api/payments/webhook` subscribed to `payment.captured` and `payment.failed`.
Then decide whether the free plan's caps are real: `PLAN_LIMITS_ENFORCED=true` is what turns the
published "3 chats a day, 1 questionnaire" into a refusal, and it defaults to **false**, which is why the
pricing page prints a note about its own deployment rather than letting the numbers read as promises.

**What has not been proved.** No order has ever been opened against Razorpay and no payment has ever
been captured. All 172 checks run against a stub that answers the way the API is documented to answer,
which proves this app's arithmetic, signatures, idempotency and entitlements and proves nothing about
Razorpay's service. The card sheet has never been seen through this app's `frame-src`, and the webhook
has never been fired from that dashboard — see §5's list.

### Measuring pages: two services that stay off until somebody switches them on

`src/components/analytics/Analytics.tsx` is mounted once, in the root layout inside a `<Suspense>`.
It loads Google Analytics 4 and Microsoft Clarity through `next/script` with
`strategy="afterInteractive"`, and it will not load either unless **all three** of these hold:

1. **A project is named.** `NEXT_PUBLIC_GA_MEASUREMENT_ID` or `NEXT_PUBLIC_CLARITY_PROJECT_ID` is
   non-empty. With neither set — the state this repo ships in — no request to either vendor is made
   by anybody, and `analyticsConfigured()` is what the consent banner reads, so the banner's promise
   and the page's behaviour cannot drift apart.
2. **The visitor said yes.** `settled && hasConsent("analytics")` from `useCookieConsent()`. Consent
   is never assumed: the first render is `settled: false`, so nothing can fire before the device has
   answered.
3. **This is a public page.** `isPrivateSurface(pathname)` blocks `/app`, `/parent`, `/onboarding`,
   `/sign-in`, `/sign-up` and `/account`. Clarity records clicks, scrolling and a replay of the page's
   own elements — including text sitting in an input box — so on a student's or a parent's screen it
   could record a conversation. A page that starts public and navigates into the app re-decides this
   in the same session; it does not carry the scripts across.

What is sent is deliberately small: one `page_view` per public path, with `page_path`,
`page_location` and the referring *path* — query and hash are stripped before the hit goes out. The
GA4 config sets `send_page_view: false` (this component sends the views, so a route change cannot
double-count), `allow_ad_personalization_signals: false`, `allow_display_features: false`,
`anonymize_ip: true`, `transport_type: "beacon"`. There is no custom event, no user property and no
identifier of this student anywhere in it — the device id never leaves the app.

Turning it off again is real. `rejectAll()`, or the analytics switch in *Manage preferences* going
off, calls `clarity("stop")` and clears `_ga`, `_gid`, `_ga_<property>`, `_clck` and `_clsk` at both
cookie scopes plus any `_ga*` / `clarity_*` key in `localStorage`. A surviving cookie is a reporting
bug, not a security hole, which is why the code says best-effort.

To switch it on for a deployment: create the GA4 property and the Clarity project, put both ids in
the frontend's environment (Vercel → Settings → Environment Variables), and redeploy.
`middleware.ts` reads the same two ids and adds `googletagmanager.com`, `*.google-analytics.com`,
`*.analytics.google.com` and `*.clarity.ms` to the CSP only while they are set, so there is nothing
else to edit and no wildcard to open up. Then accept analytics on a public page and watch the
Network panel; go to `/app` and watch nothing fire.

### School and counsellor portals: one deployment, several institutions

The brief asked for `frontend/app/(school)/school/dashboard/page.tsx` and a counsellor twin. This repo has no root `app/` and no route groups, so the two screens are `frontend/src/app/school/dashboard/page.tsx` and `frontend/src/app/counsellor/dashboard/page.tsx`, and a portal is addressed with `?portal=<slug>` rather than with a folder per school: `<slug>` is data, and making it a path segment would turn every one of those pages dynamic for no benefit. The sidebar's "Your portals" group carries the same link a subdomain would.

`backend/app/models/tenant.py` and `backend/app/api/organizations.py` do not exist as separate files either. The tables live with the rest of the schema in `backend/app/models.py` (`organizations`, `memberships`, `organization_branding`, `session_notes`), the 28 routes in `backend/app/routers/organizations.py` mounted at `/api/organizations`, the tests in `backend/scripts/tenancy_test.py`, and the subdomain resolver — which the brief did not name and every portal screen depends on — in `backend/app/middleware/tenant.py`. Alembic head was `0007_tenancy` until the operator's dashboard added `0008_admin_audit`.

| Screen | Who sees it | What it holds |
| --- | --- | --- |
| `/school/dashboard?portal=<slug>` | a school's staff | Overview (summary cards, questionnaire analytics), Roster (invite one address or paste a class list, assign a counsellor, cancel an invite, take a place back), Look (branding), Places (the tier and its seats) |
| `/counsellor/dashboard?portal=<slug>` | a practice's staff | The same four, plus Clients and Session notes (write, share, unshare, delete) |
| either screen, for a member who is not staff | a student or parent member | MemberView only: the portal's own welcome note, the member's own sharing switch, the notes a counsellor shared *with them*, and Leave this portal |
| `/join?token=…` | whoever holds an invitation link | The portal's public face, the sharing choice, and the one action that turns an invitation into a membership |

What a portal may and may not do is a server rule, not a screen rule:

* **Roles.** `users.role` stays `student` or `parent`. `student`, `parent`, `counsellor` and `school_admin` as *portal* roles live on `memberships.org_role`, and "may this request see that row" is computed from it on every call (`require_admin` / `require_member` in `backend/app/security.py`). `super_admin` is not a column, an enum value or a token claim anywhere in this schema; the platform operator's own account is `users.is_admin` (see below).
* **Opening one.** `POST /api/organizations` creates a **counsellor** practice and refuses a `student` account outright. A **school** portal is opened only through `POST /api/organizations/admin` by an operator account, which becomes that school's first administrator until its staff are invited — a self-serve `kind` would let any account declare itself an institution, and the word `verified` is only ever written by a person who looked.
* **Nothing before acceptance.** An invitation row holds an address, the sha256 of a token and an expiry; it answers no roster, no analytics and no report to anybody. `POST /api/organizations/join` is the only route that activates a membership, and the token is its entire proof — it does not check that the person opening it is the person the address belongs to. Joining writes `user_id`, sets `active`, stamps `joined_at`, clears `invited_email` and `invite_hash`, and sets `share_results` to whatever *that person* chose: the only place in the feature where a student's sharing decision is written by anyone other than the student.
* **The switch is the student's.** It defaults to off in the column, in the created invite, and in the join body. Turning it on hands the portal the reports that portal was invited to. A student's conversations and unfinished answers are not reachable from any portal route at any staff role — `tenancy_test.py` asserts that by aiming other people's ids at every one of them.
* **Numbers, not children.** `GET /{slug}/analytics` aggregates on the server and withholds any group under `MIN_REPORTABLE_COHORT = 5`, then lists what it dropped. A school of eleven cannot be handed a statistic that points at one child.
* **Seats are counted, never bought.** Tiers come from `backend/app/services/reseller.py`; every tier answers `purchasable: false` with `price_rupees: null`, no portal screen charges a card, and a bulk list is capped at 50 lines *and* by the seats left.
* **A logo is a host you named.** `NEXT_PUBLIC_ALLOWED_LOGO_HOSTS` is one list read by both the CSP builder (`img-src`) and the component gate that decides whether to render the `<img>` at all. Unset — which is how this build runs — no external logo is drawn anywhere, and a portal shows its name and its colours.
* **Subdomains are presentation, and fail closed.** `middleware/tenant.py` resolves `green-school.<TENANT_BASE_DOMAIN>` from `Host`, or from `X-Forwarded-Host` only when `TENANT_TRUST_FORWARDED_HOST=true`, which is for a proxy that overwrites that header. A resolved slug decides which portal's *branding* a screen paints; it authorises nothing. The bearer token and the membership row still decide every read, so a school that spoofs a neighbouring school's hostname reads nothing.

**Subdomains: configured, not verified.** The resolver, the backend env var and the frontend's `NEXT_PUBLIC_TENANT_BASE_DOMAIN` exist, the resolver is unit-tested against a fabricated `Host`, and locally `*.careerguide.localhost` resolves with no DNS work at all. What has *not* been done anywhere real: a wildcard `A`/`CNAME` record, that wildcard added to the Vercel project's domains, and every resulting origin added to `CORS_ORIGINS`. So `school.careerguide.ai` from the brief is **not live**, and each portal screen says so in one sentence on screen — "This deployment has no portal subdomains configured, so the portal is reached at `/school/dashboard?portal=…`" — instead of printing an address that does not resolve.

**Two more things this feature has not had.** No invitation has ever been mailed on this deployment (`RESEND_API_KEY` is unset), so the join link was reached the way the on-screen sentence describes: read off the invite response and opened by hand. And an earlier browser pass appeared to join with the sharing box untouched and print "visible to it" — that could not be reproduced: the instrumented rerun sends `false`, the server echoes `false`, and the row is `0`. It is recorded as an unreproduced observation, not as a bug that was fixed. Portal screens are English-only so far (`src/lib/hi/*` carries no entries for them, so a Hindi-preferring student sees English buttons there); the new portal sections of `/privacy` and `/terms` are translated.

### Studying abroad: a directory that says what it has not checked

The brief asked for a study-abroad section. The honest version of it is a **directory that refuses to
invent** — because this is the part of the product where a made-up number costs a family the most money.

**Public screens** (async server components, request-time backend reads, no sign-in needed, and — like
`/careers` and `/blog` — still English-only, since `?lang=hi` support was written for the careers/blog
set first and has not been extended here):

| Route | What it shows |
| --- | --- |
| `/study-abroad` | Countries, and what choosing one actually involves |
| `/study-abroad/[country]` | One country: its institutions, English-test requirements, and the parts nobody has verified |
| `/study-abroad/services/[service]` | What this platform would do for a family, written without a promise |

**The data, and its state.** `backend/data/universities.json` holds **510 institutions**; the loader in
`app/seed/study_abroad.py` writes **only the slugs that are missing**, so adding a university to that
file and restarting brings in that one row without touching an entry an operator has already filled in
and verified. It runs inside `scripts/db_init.py`'s `seed_if_empty()` — there is no separate seed
command to remember. Every seeded row is written with `verified=False` and `sponsored=False`, and with
`tuition_note`, `intakes`, `deadline_note`, `english_test_note` and `application_urls` **left NULL**.
A NULL renders as a labelled gap, not as a zero, not as "free", and not as sample text. The one thing a
seeded row claims confidently besides its name is its own official domain, because that is what every
unverified field on the page points the reader back to.

**The rule that matters more than the count:** a row in this directory carries a date only because a
person opened a page on that date. Nothing writes one otherwise — not the seed, not a migration, not a
request, and not the operator's own screen without a source URL. `study_abroad_test.py` asserts that the
loader marks every row it creates as unread, so a future seed cannot quietly slip nine checked-looking
entries in beside one honest gap. What a row has actually been read against is in the next section.

**Leads — the only public form in the app that stores what a person typed.** `POST /api/study-abroad/leads`
holds a name, an email address, an optional phone, a stage chosen from a short list (never a school,
never a city), the message, the country or service it came from, and `source_page`. It carries **no
`user_id` even when the sender has an account**: a marketing enquiry is not part of a child's career
record, and joining the two would let a commercial follow-up reach a student's conversation. The consent
tick is stored with its timestamp because a row cannot exist without it. The route is throttled by
**network address** rather than session (`RATE_LIMIT_LEAD`, ten an hour — the one bucket in
`middleware/rate_limit.py` that genuinely counts the address, because there is no token in front of a
stranger), and it has a honeypot field no person can see, which answers with a real-looking response so
a bot cannot tell it was refused. An address never enters a log line: the log records the row's id.

**Environment** (all optional, all fail into a stated state rather than into a fake success):

| Variable | Default | What it changes |
| --- | --- | --- |
| `LEAD_NOTIFY_EMAIL` | empty | The site owner's own mailbox, told about each enquiry. Empty means the enquiry is still stored and still on the admin screen — nothing is lost, and no mail is claimed. Deliberately **not** settable from the admin screen: a route that could point the site's public form at any mailbox in the world is a forwarding service. |
| `RATE_LIMIT_LEAD` | `10 per hour` | How many enquiries one network may send. Room for a school's counselling office; slow enough that a bot fills the table with noise instead of names. |
| `RESEND_API_KEY` + friends | empty | With no key the sender's acknowledgement is not sent, and the answer and the screen say so in words — `stored: true`, `delivered: false`. |

**Operator screen: `/app/admin/study-abroad`.** Every route under `/api/study-abroad/admin/` carries
`Depends(get_admin_user)` as a *dependency* rather than a check inside the function, so a route added
next month cannot forget it. There an operator can mark a lead contacted or closed, add a private note,
delete the row, and fill in an institution's real figures together with `source_url` and the date they
were true — which flips `verified`. An operator **cannot** flip `verified` without a source, and the
career guide never reads this table at all: `services/recommender.py` does not import it, so a paid or
priority listing cannot change what a child is told. Nobody is an operator out of the box — the flag is
granted with `backend/scripts/admin_grant.py` (see below), and without it every route in this section
answers `403` in words.

**Legal copy that was written for the app, not from a template** — all three pages now carry their own
study-abroad section, in English and हिन्दी: `/privacy` ("Study-abroad enquiries": what one row holds,
where it goes, that the throttle counts your network address, and that no clock deletes it), `/terms`
("The study-abroad directory and its enquiry form": not an application service, not a visa adviser, a
blank means "nobody has checked"), and `/disclaimer` ("The study-abroad directory"), whose list of
things nobody here guarantees now includes **a visa, an entry permission, or a right to study in any
country**.

**What is still not done here.** 12 of the 510 institutions have had their name, city and link read off
their own website and stamped; the other 498 carry no date and say so. None of the fee, deadline, intake or
English-test fields on any row has been read from anywhere — they are still NULL on every one of the 510.
The enquiry mail has never been sent for real on this deployment; there is no self-service button for a
sender to pull their own address back out (that is an operator delete, or a request through `/contact`); the
admin screen's routes are refusal-tested but no operator action on a lead has been walked in a browser since
the study-abroad screen was written; and these public pages are not yet Hindi. Turning the directory into
something a family could rely on is a research job, not a code job — someone has to read 510 fee pages.

### "Verified on …": a badge nobody can light by accident

**Written 2026-10-23.** The request for this feature came as two halves: put `source_url` and `verified_at`
on `Career`, `University` and `Scholarship`, migrate them, and then *"write a script that populates
`source_url` with a dummy official link and sets `verified_at` to today's date, for the top 10 careers and
all universities."* The first half is built. The second was not, and the reason is in the app's own rules:
"Do not invent scheme names, eligibility, deadlines or benefits" and "Never represent hardcoded sample
schemes as live verified results." A script that stamps today's date next to a link nobody opened does
exactly that — it prints a confidence the database has no record of, on pages a fifteen-year-old chooses a
career from. So the columns, the migration, the API fields and the whole interface arrived as asked, and the
bulk-stamping script arrived as a tool that can only record a check somebody actually did.

**The columns.** Migration `0016_career_source` adds `careers.source_url`, `careers.verified_at` and
`scholarships.source_url` — all nullable, all with no default, so every existing row arrives as "nobody has
read this yet". `universities` already had the three, which is why this is a column migration and not a new
scheme. `scholarships` deliberately gets no `verified_at`: it keeps `last_verified_at`, and a second
timestamp for the same question is a second, disagreeing answer. `careers.needs_verification` and
`scholarships.needs_verification` stay, but they are now a warning flag rather than the whole story — the
badge reads the pair `source_url` + `verified_at`, because a flag can be flipped and a date cannot be
earned.

**Four ways a green badge could appear without anybody checking, and what closes each one:**

| The way | The closing |
| --- | --- |
| The database gives a row a date on its own | Nullable, no default, and the migration writes no dates. A row cannot arrive certified. |
| A request sets the fields | `CareerOut`/`ScholarshipOut` expose them read-only; the write schemas are `StrictIn` (`extra="forbid"`), so `source_url` in a payload is a `422`, and the admin content route refuses `needs_verification` as "not editable here". A university's `verified` needs a `source_url` with it. |
| A shell is handed a date | `verify_data.py attest` has **no date argument**. `--verified-at` is an unrecognised option; the date is `datetime.now(timezone.utc)` inside the script, and nothing else can supply one. |
| A shell is handed nothing but a link | `--read` is required: the person states what they compared. The URL must be https, on a host the script recognises as a government body, regulator, exam board or institution, and it is stored verbatim and printed on the card, so a wrong link is visible rather than load-bearing. |

**`backend/scripts/verify_data.py`** is the whole path from "unchecked" to "checked", and it writes nothing
except under `attest`:

```bash
./.venv/Scripts/python.exe scripts/verify_data.py report                       # where every table stands
./.venv/Scripts/python.exe scripts/verify_data.py worklist --kind career --limit 10
./.venv/Scripts/python.exe scripts/verify_data.py attest --kind career --id <slug> \
    --source-url <the exact page you opened> --read <what you compared it against> [--dry-run]
./.venv/Scripts/python.exe scripts/verify_data.py unattest --kind career --id <slug>
```

`worklist` prints, per row, the sentences a student would plan around (the first two entry requirements, the
first two pathways, the cost line) and the link to open — it is the list, not a shortcut. `attest` refuses
before it writes when the identifier names no row, when the address is not https on a public host, when that
host is not on its list, and when `--read` is too short to name a fact (under ~25 characters, because a line
that short was typed without the page open); each refusal leaves the row untouched and prints nothing but the
reason. Re-attesting a row that already has a source is allowed and overwrites it — that is the correction
path, and `unattest` exists because a check can turn out to have been wrong, so taking the badge back off is
one command. Every accepted attestation and every `unattest` goes into `audit_events` with
`origin="script"`, a null actor and the URL in the detail, which is how a change made from a shell is told
apart from one made by an operator on a screen.

**The interface** is one component, `SourceBadge` in `src/components/ui/badge.tsx`, on the three surfaces
this round was scoped to: `/app/careers/[slug]`, the institution rows on `/study-abroad/[country]`, and the
rows on `/app/scholarships`. Two states, and the difference between them is a fact about the database rather
than a style: a date means somebody opened a page, no date means nobody has. Clicking either opens a small
panel that says which, and lists the page that was read (`source_url`, monospaced under its own label)
beside the places the same figure would otherwise have to be checked — the institute's own site, the apply
portal, the regulator. The unchecked state is grey, not red: the old "Needs Verification" badge read as an
error in the app on the page where a student is meant to feel welcome, when what it names is an ordinary
unfinished step in checking a number. The date is rendered in UTC from a naive UTC stamp, because a
verification done in the Indian evening would otherwise print tomorrow's date; English reads
"Verified 23 October 2026" and हिन्दी "23 अक्टूबर 2026 को सत्यापित".

**The legal page had to be re-read, because this feature changes what it describes.** `/disclaimer`'s
"Accuracy and currency of information" section already said the catalogue is sample data that the app never
checks before displaying — true as a rule, and now incomplete, because 12 rows *have* been read and a card
can say so. It gained a paragraph after those two, before the model-cutoff sentence, stating what a date on a card does and does not
claim: a named person opened the named page that day and compared what the row actually asserts (for an
institution, its name, its city and its own address), the page is stored beside the date so the claim can be
checked instead of trusted, and a date says nothing about a fee, a deadline or an eligibility rule unless the
row names a source for those. A card with no date, it says plainly, is the app’s own note. The older
sentences were left standing rather than softened: the app still does not verify a row before showing it, and
no date is a guarantee about tomorrow. The Hindi key for it is in `src/lib/hi/trust.ts`; `hi-prose-check.mjs`
reports **0** prose literals missing from `src/app/disclaimer/page.tsx`, and both languages were read back in
the browser on that section (`#accuracy`) before this paragraph was written.

**What this round measured, not assumed.** `scripts/verification_test.py` (new, **72 checks**) drives the
script and the API against a temporary database and asserts the four closings above as behaviour: that the
596 seeded rows arrive with no page and no date, that no request field can light the badge, that `attest
--help` contains no date option and that `--verified-at` is refused, that six refusals each leave the row
exactly as they found it with no audit entry behind them, that an accepted attestation stores the URL
verbatim and *today* as its date and logs one `origin="script"` row, that `--dry-run` writes nothing, that
`unattest` clears all three columns, and that a hand-made half-state (a page with no date) is reported as
the impossible thing it is rather than counted as verified. `migration_test.py` grew four checks for 0016
and now stands at **225**.

**The data state as it actually stands tonight:** careers **0 of 55**, scholarships **0 of 31**,
universities **12 of 510** — the 10 Irish institutions whose own home pages were opened during this pass,
plus the 2 Australian ones from the earlier walk. Each of those 12 has the page it was read from stored in
`source_url`, and the claim checked was the only claim the row makes: name, city, and the domain it links
out to. Fees, deadlines and entry requirements remain NULL on all 510, so the badge on those rows says
"read off the college's own page", not "the figures are right".

The other four Irish rows on the same list were **left unattested on purpose**, and that is the tool working:
`maynoothuniversity.ie`, `ucd.ie` and `setu.ie` answered `403` to being fetched, `griffithcollege.ie` refused
the connection at all, `atu.ie` names several campuses and no main town, so the row's "Galway" was not
confirmed by anything it said, and **`rcsi.com` now calls itself "RCSI University of Medicine and Health
Sciences"** where the row still reads "Royal College of Surgeons in Ireland" — a stale name on a card, found
by reading instead of by stamping. That last row needs an edit, not a badge. The same 403/unreachable pattern
is why no career is green yet: the pages this catalogue points at (`icai.org` and friends) would not load
from this machine, and a link copied without being read is precisely what the tool refuses to record.

**Not in this round's scope**, deliberately: the public `/careers` cards and the printed PDF still carry the
older `VerificationBadge`, the institutes and resources screens were not touched, and the operator's content
screen keeps its own certify flow. Those are four more surfaces with the same question on them, and they can
now be moved onto `SourceBadge` one at a time without any of them being able to invent a date.


The brief asked for `frontend/app/(admin)/admin/*`. This repo has no root `app/` and no route
groups — every signed-in screen lives under `src/app/app/`, which is what the existing
`/app/admin/study-abroad`, `/app/school`, `/app/counsellor` and `/app/parent` screens already do. So
the paths map one-for-one: `layout.tsx` → `frontend/src/app/app/admin/layout.tsx`, and each page to
its own folder under the same prefix. `/app/admin` itself is a two-line redirect to `/app/admin/dashboard`,
because an empty page at the address an operator types first looks like a broken feature.

The backend mapping is the same kind of translation. `backend/app/api/admin/*.py` →
`backend/app/routers/admin.py` (one router, matching `routers/assessments.py`, `routers/payments.py`
et al. — a package of eight files for one prefix would have split the guard across them), and
`backend/app/models/audit.py` → `AuditEvent` in `backend/app/models.py` with migration
`20261019-0008_admin_audit.py`.

**The short answer to "add middleware check" is that there is no such middleware, and that is
deliberate.** Every route in the file hangs off `APIRouter(prefix="/api/admin",
dependencies=[Depends(get_admin_user)])`, so a route cannot be added under that prefix without
passing the check. A path-prefix middleware sees a URL and not a verified caller — at that point the
bearer token has not been resolved, so it would either duplicate the session lookup (two copies of
the auth logic, and the next person to change one forgets the other) or run before authentication and
be a rule about strings any request can satisfy. `admin_test.py` proves the guard from outside rather
than trusting that sentence: it calls **every** operator route as an anonymous caller, as a student,
as a parent and as a *school's own administrator*, and requires `401` or `403` on each. That sweep is
built from `app.openapi()["paths"]`, so a route added next month is refused-tested the day it is
registered — a hand-maintained list would go stale in exactly the one way that matters.

**`role=admin` does not exist here, and this document does not pretend otherwise.** `users.role` says
only `student` or `parent`, because that column describes what an account is to its own family. The
operator flag is `users.is_admin`, defaulting to `False`, and NULL counts as not-an-admin — which is
what makes widening an existing database safe: every account that predates the column is refused by
it. No request body anywhere in the API has a field that can grant it; the suite asserts that against
the generated schema rather than against a list. The only way in is the CLI, in the account's own
terminal:

```bash
cd backend
./.venv/Scripts/python.exe scripts/admin_grant.py --list
./.venv/Scripts/python.exe scripts/admin_grant.py --email someone@verified-address.in
./.venv/Scripts/python.exe scripts/admin_grant.py --email someone@verified-address.in --revoke
```

An address that is saved on an account but never confirmed is refused — "Open the confirmation link
in that mail, then run this again" — because granting on a typed-but-unopened address would hand the
whole site to whoever typed it. The change takes effect on that account's next request; nothing needs
restarting. `--list` prints who holds it, and says plainly when nobody does.

**What the six screens are:**

| Screen | What it shows | What it refuses |
| --- | --- | --- |
| `/app/admin/dashboard` | Counts in six groups — accounts, conversations, assessments, money, portals, and a "waiting on somebody" group — all read at the instant the page says | Nothing estimated or projected, no growth percentage, no ranking of people. It states on the page that it cannot open a conversation, cannot say who talked most, and cannot say what a payment was for |
| `/app/admin/users` | Search by name or id, filters on role / state / operator flag, a 25-row pager, and per row: plan and expiry, whether an address is attached, and counts of that account's own conversations, sittings and memberships | No delete — closing an account is the whole of what may be done to one, and it asks twice. No email search. No reading of what the account said |
| `/app/admin/content` | Careers (search, a needs-verification filter, an editor over 11 text fields plus 11 comma-or-newline lists), questionnaire items (text in both languages, dimension, key, response type, order, correct answer) | The blog tab has no form — it renders the API's own sentence saying the blog is files in the repo, and where they live. A question that already has answers under it renders no Edit button at all. A career editor cannot change its slug and cannot switch its own `needs_verification` flag |
| `/app/admin/exams` | The entrance-exam catalogue as data rather than as text in a page: the doors and the exams under them, an add form for each, an editor over every field of a row, and hide / delete. A date and a fee each sit beside their own source box, and the screen says in plain words that a figure stays invisible to students until the row is ticked as read from the notification | Nothing here can publish a figure it made up: the server refuses a date or a fee with no source, refuses a source that is not a URL, refuses to clear the source off a row that is already standing behind a figure, and refuses to delete a door that still holds an exam. Filling the source box does **not** tick the row — the tick is the operator stating they read the page. A write that is refused leaves what was already saved saved, and the sixth write in a minute is answered with a `Retry-After` rather than a silent queue |
| `/app/admin/leads` | Study-abroad enquiries with the consent tick next to the address it covers, the family's message as typed, stage, and a private note | The newest 100, stated as a caption rather than given a dead pager. Deleting is confirmed twice and the row says why closing would have been enough |
| `/app/admin/study-abroad` | The screen built before this one — linked from the nav rather than rebuilt | — |
| `/app/admin/settings` | Every non-secret the running process holds (AI provider and voice, mail, payment keys as **present/absent booleans only**, sign-in, tenant base domain, the limits a student meets, the throttle rules) and the append-only audit log with filters on action, actor and date | There is no Save button: these values come from `backend/.env` / the Vercel project's environment, and a form that wrote them would either touch the platform's file or lie about having done so. No key value is printed, not even truncated. The log has no delete and no clear |

`layout.tsx` is the gate for all six. It waits for the session, calls `GET /api/admin/me`, and does
not render `children` until that answers — a `401`/`403` becomes a panel that says this account is not
the operator's one and prints the exact `admin_grant.py` command, anything else becomes a panel that
says the API did not answer and offers "Check again". The gate is not what keeps anybody out (the
router dependency is); it is what keeps six screens from each inventing their own version of "this
account is not the admin one". It is a labelled nav bar rather than a second sidebar because
`AppShell` already owns the sidebar, the header and the mobile drawer — a second column would have
been two navigations at 1280px and an unusable drawer on a phone.

**Honest state of this feature.** The six screens listed above typecheck, lint clean, and build (`npm run
build` emits `.next/server/app/app/admin/{dashboard,users,content,leads,settings,study-abroad}`); the
backend routes and the refusal sweep are covered by `admin_test.py`, **134 checks, 0 failed**.
`/app/admin/exams` is the seventh: `tsc --noEmit` and `eslint src` cover it (both re-run 2026-10-20, exit
0), its routes are covered by `exams_test.py` (**91 checks**), and it was walked in a browser against a
live operator session the same day — the flag granted to a throwaway account, the operator table, the add
form and the row editor used for real, the flag taken back afterwards. `npm run build` has **not** been re-run since
that screen was added, so the route count in §5 is still the six-screen number, and it is the first thing
to re-measure before this row is restated. The `:8000` process on this machine is still the container that
predates `routers/admin.py` (`/api/health` answers, `/api/admin/me` is a 404); the work above was done
against a fresh backend on `:8100`, which is why the two ports are never interchangeable here. The six
older operator screens carry हिन्दी like the rest of the app; `/app/admin/exams` is the gap — the **44
strings** `hi-coverage.mjs` lists for it — because it was written after that localisation pass. Recorded as
a gap, not as a decision. Money is
summed in paise and `test_paise` is kept out of the captured total, because a test-mode payment moved
nothing.


`app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx` and `pageMeta()` in `src/lib/site.ts`
do the indexable half. The rules worth knowing:

- `robots.txt` disallows `/app`, `/api`, `/admin`, `/parent`, `/onboarding`, `/sign-in`, `/sign-up`
  and `/account`, and those layouts export `robots: NOINDEX` as well. A crawler that ignores
  `robots.txt` is why the second one exists; neither is protection, which is what §6 is for.
- The sitemap lists the public pages, every career profile and every guide. Career slugs are
  revalidated against `/^[a-z0-9-]+$/` before they become URLs, and if the backend does not answer in
  four seconds the sitemap ships with no career entries instead of failing to build.
- Canonicals, OpenGraph urls and the sitemap all come from `NEXT_PUBLIC_SITE_URL`; nothing is
  hardcoded to a domain that may never exist.
- JSON-LD never claims a fact the page's own prose admits it does not have: no `offers`, no salary,
  no aggregate rating, no founder. The `FAQPage` node on `/pricing` is generated from the same array
  the page renders, so the answer a search engine reads cannot differ from the one a person reads.
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is a placeholder that stays invisible until filled. Search
  Console cannot be verified for a domain this project does not own, so shipping a fake token would
  be a broken feature wearing a meta tag.

---

## 5. Verify it yourself

```bash
cd backend
./.venv/Scripts/python.exe scripts/smoke_test.py
./.venv/Scripts/python.exe scripts/login_test.py
./.venv/Scripts/python.exe scripts/guest_session_test.py
./.venv/Scripts/python.exe scripts/conversation_facts_test.py
./.venv/Scripts/python.exe scripts/assessment_test.py
./.venv/Scripts/python.exe scripts/migration_test.py
./.venv/Scripts/python.exe scripts/report_pdf_test.py
./.venv/Scripts/python.exe scripts/tts_provider_test.py
./.venv/Scripts/python.exe scripts/serverless_guard_test.py
./.venv/Scripts/python.exe scripts/clerk_auth_test.py
./.venv/Scripts/python.exe scripts/security_test.py
./.venv/Scripts/python.exe scripts/payments_test.py
./.venv/Scripts/python.exe scripts/email_test.py
./.venv/Scripts/python.exe scripts/email_flow_test.py
./.venv/Scripts/python.exe scripts/study_abroad_test.py
./.venv/Scripts/python.exe scripts/tenancy_test.py
./.venv/Scripts/python.exe scripts/admin_test.py
./.venv/Scripts/python.exe scripts/exams_test.py
./.venv/Scripts/python.exe scripts/erasure_test.py
./.venv/Scripts/python.exe scripts/resume_test.py
./.venv/Scripts/python.exe scripts/roadmap_test.py
./.venv/Scripts/python.exe scripts/interview_test.py
./.venv/Scripts/python.exe scripts/verification_test.py
./.venv/Scripts/python.exe scripts/schema_fit_check.py
cd ../frontend && npx tsc --noEmit && npx eslint src && npm run build
node scripts/hi-coverage.mjs          # which UI strings have no Hindi yet
node scripts/hi-prose-check.mjs       # the ones passed through a variable (SECTIONS, VALUES)
node scripts/hi-duplicates.mjs        # the same key written twice — the last file wins, so check it
```

Last runs on this machine. The date in the right-hand column is the last time that row was actually
executed — a suite that has not been re-run says so rather than riding on an older result.

**On 2026-10-22, students got a resume.** The §4 row above says what the screen is; this is the measurement
behind it. `Resume` joined `backend/app/models.py` and migration `0014_resume` built it (fourteen revisions,
`user_id` as the primary key, three JSON lists and the job title aimed at); `app/routers/resume.py` serves
`GET`/`POST /api/resume` and `POST /api/ai/resume-suggest`, the suggester got its own `RATE_LIMIT_RESUME`
bucket because it is the one resume route that spends a provider call, `app/services/resume_suggest.py` answers
from the career catalogue or the configured model and always says which, and `DELETE /api/users/me` now counts
the CV among what it removes. `scripts/resume_test.py` is new; `scripts/erasure_test.py`'s fixture writes a
resume so the claim is checked rather than assumed. On the frontend: `/app/resume`, a sidebar and dashboard
entry, `src/lib/hi/resume.ts`, and the legal pages re-read for what the feature now stores and now sends —
`/privacy`, its Hindi dictionary, and Settings' delete card all name the CV, and the privacy page's Groq
section says which one field of that document reaches a model.

**Measured here on 2026-10-22: 20 suites, 2 182 checks run, 2 181 passed, 1 failed.** The one failure is
`tts_provider_test.py`'s single live Gemini call, which answered `429` — the same free-tier request quota this
machine hit on 2026-10-21 — and its live Azure call skipped for want of a key; nothing in this change touches
speech and that suite's 72 offline checks passed. Counts that moved: `resume_test.py` **84** (new),
`erasure_test.py` 83 → **85**, `migration_test.py` 211 → **213**. Every other suite printed exactly the number
it printed on 2026-10-21: smoke 104, login 62, guest_session 71, conversation_facts 49, assessment 117,
report_pdf 69, serverless_guard 10, clerk_auth 106, security 146, payments 172, email 113, email_flow 89,
study_abroad 166, tenancy 227, admin 135, exams 91.

**Measured on the frontend the same day:** `npx tsc --noEmit` and `npx eslint src` both exit 0 (the resume
screen's first draft kept an import of a `cn` helper it had stopped using, which the linter refused).
`npm run build` exits 0 with **63 page routes**, `/app/resume` among them. `node scripts/hi-duplicates.mjs`:
**2 102 keys**, 3 conflicting duplicates — the same three that predate this feature, none new.
`node scripts/hi-coverage.mjs`: nothing on the resume screen without Hindi. `node scripts/hi-prose-check.mjs`
ran clean on the section lists it covers.

**Two things the brief named literally and the code does differently, both on purpose.** `Resume` has no `id`
column: `resumes.user_id` *is* the primary key, the same shape `user_settings` uses, so "one CV per account"
is a database fact rather than a rule every route has to remember — and a student's CV is one document, not a
list to paginate. And the model, the router and the schemas live where this backend keeps them
(`app/models.py`, `app/routers/resume.py`, `app/schemas.py`) rather than `app/models/resume.py` and
`app/api/resumes.py`: there is no `app/api/` package here, and inventing one for a single table would leave
every later reader two conventions to learn. §4's portals row records the same kind of deviation for the
tenancy tables.

**On 2026-10-23, a finished result stopped being only a picture of the answers.** `app/services/roadmap.py`
is new and holds the whole feature: `plan_for()` writes the skill gap and the four weeks from the scores a
sitting already produced, `render()` turns the stored, language-neutral shape back into sentences in whatever
language the page is being read in, `facts()` is the only thing about a student that ever reaches a model,
`plan_with_ai()` asks the configured provider for the same document in its own words, and `guide_note()` hands
the guide the four weeks the student is looking at. `roadmap_json` joined `Result` (migration
`0015_result_roadmap`, fifteen revisions) and the plan is written **at submit**, so opening a result never
waits on a provider and a sitting scored without one still explains itself.
`POST /api/assessments/result/{id}/roadmap` is the ✨ button, with its own `RATE_LIMIT_ROADMAP` bucket; the
read now carries `roadmap`, `roadmap_ai_available` and `roadmap_note`, which is how a page can say who wrote a
plan and what happened when a rewrite was refused. The chat learned `plan_of` on
`POST /api/conversations/{id}/messages` — a number that is not this account's result answers `404` rather than
handing over a peek. On the frontend: `components/assessments/RoadmapSection.tsx` for the two cards, the
pinned plan card on `/app/chat`, and `src/lib/hi/roadmap.ts`.

**Measured on 2026-10-23: 21 suites, 2 392 checks run, 2 391 passed, 1 failed.** The one failure is the same
single check that failed on 2026-10-22 and on 2026-10-21: `tts_provider_test.py`'s one live Gemini call, which
answered `429 Too Many Requests` again on the free-tier key this machine tests with, while its live Azure call
prints `SKIP` for want of a key and the suite's 72 offline checks pass. Nothing in this change touches speech.
Counts that moved: `roadmap_test.py` **205** (new, written with the feature) and `migration_test.py`
213 → **218**, because the chain now ends at `0015_result_roadmap` and all three builds compare the `results`
table with its plan column in it. Every other suite printed exactly the number it printed the day before:
smoke 104, login 62, guest_session 71, conversation_facts 49, assessment 117, report_pdf 69, serverless_guard
10, clerk_auth 106, security 146, payments 172, email 113, email_flow 89, study_abroad 166, tenancy 227,
admin 135, exams 91, erasure 85, resume 84.

**Measured on the frontend the same day:** `npx tsc --noEmit` and `npx eslint src` both exit 0.
`npm run build` exits 0 with **63 page routes** — this feature adds none, the plan rides the existing
`/app/assessments/result/[id]/page`. `node scripts/hi-prose-check.mjs`: 0 missing.
`node scripts/hi-coverage.mjs`: **423** strings still without Hindi, none of them on the two new cards or the
chat's plan card — the list is the same pre-existing study-abroad, billing and journey strings it was before
this feature. `node scripts/hi-duplicates.mjs`: **2 138** keys (one legal-page key added), the same 3
conflicting duplicates that predate it.

**Three things the brief named literally, done differently on purpose.** The result row here is `Result` in
`app/models.py`, not an `AssessmentResult` class, so the column is `results.roadmap_json`. The page the brief
calls `frontend/src/app/assessments/result/[id]/page.tsx` is `src/app/app/assessments/result/[id]/page.tsx`
under this router's `/app` layout, and its two new sections are one component rather than three hundred more
lines in the page. And the plan is deliberately **not** written inside `scoring.py`: scoring's job ends at
"what did these answers say", a plan is a claim about what to do next, and the two failing in different ways
is exactly why they are in different files with different suites.

**On 2026-10-23, a card learned to say when it had been read.** §4's "Verified on …" section is the feature;
this is the measurement. Migration `0016_career_source` (seventeen revisions) added `careers.source_url`,
`careers.verified_at` and `scholarships.source_url` — nullable, no default, and the migration itself writes
no dates — and `app/schemas.py` exposes all three on the reads while keeping them off the writes.
`scripts/verify_data.py` is new: `report`, `worklist`, `attest`, `unattest`, with the date taken from the
clock and never from an argument. `scripts/verification_test.py` is new with it. On the frontend one
component, `SourceBadge`, replaced the red badge on `/app/careers/[slug]`, the institution rows on
`/study-abroad/[country]` and the rows on `/app/scholarships`, and `src/lib/hi/common.ts` carries its Hindi.

**Measured here the same day: 22 suites, 2 471 checks run, 2 470 passed, 1 failed.** The failure is the same
single check that failed on 2026-10-21 and 2026-10-22: `tts_provider_test.py`'s one live Gemini call, which
answered `429` on this machine's free-tier key again; its 72 offline checks pass and nothing in this change
touches speech. Counts that moved: `verification_test.py` **72** (new) and `migration_test.py` 218 → **225**,
because the chain now ends at `0016_career_source` and the four new checks cover the columns on a fresh
build, on a database the boot sync got there first, in the offline diff, and with a recorded source that
survives the whole chain. Every other suite printed exactly the number it printed before: smoke 104, login
62, guest_session 71, conversation_facts 49, assessment 117, report_pdf 69, serverless_guard 10, clerk_auth
106, security 146, payments 172, email 113, email_flow 89, study_abroad 166, tenancy 227, admin 135, exams
91, erasure 85, resume 84, roadmap 205.

**Measured on the frontend the same day:** `npx tsc --noEmit` and `npx eslint src` on the two changed files
exit 0; `npm run build` exits 0 with **63 page routes** — the feature adds none, the badge rides three pages
that already existed. `node scripts/hi-prose-check.mjs` on `badge.tsx` and `common.ts`: 0 missing.
`node scripts/hi-coverage.mjs`: nothing in the badge or its panel without Hindi; the 423-string list is the
same pre-existing one. `node scripts/hi-duplicates.mjs`: **2 146** keys, the same 3 conflicting duplicates
that predate it.

**Re-measured after the last copy edit**, because the numbers above were taken before `/disclaimer` gained
its paragraph about what a date means: `node scripts/hi-prose-check.mjs src/app/disclaimer/page.tsx` → **0**
prose literals missing, `npx tsc --noEmit` → exit **0**, `npx eslint src` → silent, `npm run build` → exit
**0** and still **63 page routes** (a paragraph adds none), `node scripts/hi-coverage.mjs` → **2 147** keys
with the candidate count and the **423** untranslated strings unchanged, so nothing new went untranslated,
and `node scripts/hi-duplicates.mjs` → the same 3 conflicts. In the browser the `#accuracy` section of
`/disclaimer` was read back in English, then with `careerguide.ui-lang=hi` in Devanagari, the new paragraph
sitting between "…live verified results" and the model-cutoff sentence both times; the setting was put back to
`en`. §4 records what that paragraph says and why the older sentences around it were left standing.

**On 2026-10-23, students got a practice interview.** §4's `/interview-prep` row is the feature; this is the
measurement behind it. `app/services/mock_interview.py` and `app/routers/interview.py` are new;
`POST /api/ai/mock-interview` joins `/api/ai/resume-suggest` on the `ai_router`, with its own
`RATE_LIMIT_INTERVIEW` bucket because it is a route that spends a provider call. No table, no column, no
migration: the sitting exists only in the request. `scripts/interview_test.py` is new with it — **126 checks,
0 failed** — and the four things it refuses to assert loosely are storage, the cap, the ✨ button and the
disclosure. Storage is *measured*, not promised: every table is counted before and after a whole sitting, and
then every row of every table is scanned for the sentences that were typed, so a leak would show as a table
whose count moved rather than as a comment in a test. The cap is walked turn by turn (1…5, then a sixth answer
that closes) and attacked from outside — a body carrying `max_questions: 20`, a `question_number: 6`, a
`system` speaker, a 16-line history — all four refused `422` by `StrictIn` and `maxItems`, which is why the
limit cannot be talked past by the caller or by the model. The ✨ is checked in the direction that matters:
with no provider, `feedback` and `score` are `null` and the tips are the app's own four, so the screen cannot
print a compliment nobody earned. And a distressing answer is proven **not to reach the model** by counting
requests to a stand-in provider — zero, with a control call that proves the stand-in was reachable at all —
and a `logging.Handler` shows a failure logs the exception's type and never the student's sentence.

**Re-ran the suites this change can touch**: `resume_test.py` **84**, `security_test.py` **146**, `smoke_test.py`
**104**, all 0 failed, so the new route did not disturb the sibling AI endpoint, the guard sweep or the session
paths. The other eighteen suites were **not** re-run for this change; their counts above stand from 2026-10-23's
verification-badge battery and are not claimed here.

**Measured on the frontend:** `npx tsc --noEmit` exit **0**, `npx eslint src` silent, `npm run build` exit **0**
with **64 page routes** (63 + `/interview-prep`). `node scripts/hi-prose-check.mjs` on the new screen, its
layout, its dictionary and the dashboard: **0** missing; the same check on `/privacy` and `/disclaimer` after
their new sentences: **0** missing. `node scripts/hi-coverage.mjs`: **1 616** candidates, **423** untranslated —
the same pre-existing list, so nothing new went untranslated. `node scripts/hi-duplicates.mjs`: **2 212** keys,
the same **3** conflicts that predate this; `interview.ts` was added to its merge-order list, which is how that
script knows which of two files wins.

**Walked in a browser on the running pair** (`frontend` :3000, `backend` :8100 with the real Groq key): a
five-answer sitting for `Engineer` in English — question 1, an answer, a **FEEDBACK** note between that answer
and question 2, four more of the same, then the closing card with **78 out of 100**, the badge *for these five
answers only*, the framing sentence and three tips written for those answers. The vague answer ("I talked to my
teacher about it.") drew a specific and still kind note, and the interviewer asked a follow-up about it rather
than moving on, which is the tone the brief asked for. Then the same screen with `careerguide.ui-lang=hi` and
`careerguide.theme=dark`: the model asked its first question in हिन्दी, the badge read "सवाल 1 / 5", and every
label on the screen is Devanagari. The dashboard tile was opened from `/app` and its detail panel read back
before clicking through. The browser console stayed clean. **The no-model path was walked with a stubbed
response, not a stubbed server**: `window.fetch` was replaced on the page with one that returns exactly the
payload `AI_PROVIDER=demo` produces — the server's own five questions, four tips, closing line and
`NO_PROVIDER` sentence, copied out of `mock_interview.py` — because pointing the running frontend at a
demo-mode backend means restarting the dev server the rest of this section is measured on. It rendered the
notice, no feedback block, *इस बार कोई अंक नहीं*, the four tips under **किसी भी इंटरव्यू के लिए सामान्य सुझाव**
with the line saying they are the same for every student, all in Hindi. A live `AI_PROVIDER=demo` backend on
this screen has therefore not been run; the payload it would send is what the suite asserts. After the walk, a
scan of all **41** tables in `careerguide.db` found **zero** rows containing any sentence typed into it.

**Walked in a browser on the running pair** (`frontend` :3000, `backend` :8100, the local device account):
`/study-abroad/australia` shows two green badges and 35 grey ones and the count line reads "37 shown · 2 with
a detail somebody has read off a source"; `/study-abroad/ireland` shows **10 green and 6 grey** after the
attestation pass below; `/app/careers/chartered-accountancy` shows the grey badge and its panel names the
Institute of Chartered Accountants of India and the National Scholarship Portal as the pages that would have
to be read; `/app/scholarships` shows 31 grey badges, one per row. Each panel opens from its badge, closes on
Escape, and traps focus. Read in हिन्दी with `careerguide.theme=dark`: the badge becomes
"23 अक्टूबर 2026 को सत्यापित", the panel's three sentences are Devanagari, and the surfaces, the link colour
and the monospaced URL all paint from tokens. Back in English and light the same card reads
"Verified 23 October 2026". Two defects came out of looking rather than from a suite, and both are fixed: the
date was being parsed in the visitor's own zone, which printed tomorrow's date for an evening attestation, and
the Hindi badge read "…जाँची गई नहीं", a negation in the wrong place.

**What is now actually certified, and what is not.** 12 of 510 university rows carry a `source_url` and a
date: the 2 Australian institutions from the earlier walk, and 10 Irish ones read off their own home pages
during this pass (DCU, Dublin Business School, TU Dublin, MTU, Trinity, NCAD, UCC, RIAM, University of
Galway, University of Limerick) — each checked for the only claims the row makes, which are its name, its
city and the domain it links to. Six Irish rows stayed grey on purpose: three sites answered `403`, one
refused the connection, `atu.ie` names several campuses and no main town, and `rcsi.com` now calls itself
"RCSI University of Medicine and Health Sciences" where this row still says "Royal College of Surgeons in
Ireland" — a stale name that needed an edit rather than a stamp. **0 of 55 careers and 0 of 31 scholarships
are certified**, because the Indian official pages those rows point at (`icai.org` and friends) would not
load from this machine, and the tool's whole design is that a link copied without being read cannot be
recorded. No fee, deadline, intake or English-test figure on any of the 510 institutions has been read from
anywhere; they are still NULL, and the badge on a certified row means "somebody read this college's own page
on this date", not "the numbers are right".

**Three things the brief named literally, done differently on purpose.** It asked for `source_url` and
`verified_at` on all three models: `scholarships` already had `last_verified_at`, so a second timestamp for
one question would be a second, disagreeing answer, and that table got the page only. It asked for a script
that filled in a dummy link and today's date for the top 10 careers and all universities: that script was not
written, for the reason §4 states in full, and what exists instead can only record a check somebody did. And
it asked for a "✅ Verified on [Date]" badge replacing the red one: the green badge arrived as asked, and so
did a grey one for the rows that have no date — because replacing a warning with a certification, for 596
rows that have none, would have moved the app from honest-but-alarming to calm-and-wrong.

**On 2026-10-21, the age a student gives is a number they type, not a band they pick.** `StudentProfile.age`
(SmallInteger, nullable, migration `0013_student_age`) holds what was said; `age_range` is derived from it by
the server (`band_for_age`) on every write — a profile patch, and a fact read out of the chat — so the guide's
framework and a portal's summary keep reading the same five labels while no client can hand back a band its
own number contradicts. `PATCH /api/auth/profile` accepts `age` between 3 and 99 and refuses 2, 100,
`"fourteen"` and 14.5 with a `422` that changes nothing; clearing the field takes the number back and the band
that existed only because of it, falling back to what the class implies. The Settings control is a numeric text
input that commits on blur or Enter (a half-typed "1" is not an age) and validates the same 3–99 bounds in the
browser, so a child reads a sentence rather than a status code. **Light and dark is a device choice, not a
setting row**: `lib/theme.ts` keeps it in `localStorage` beside the interface language, `globals.css` overrides
the token families under `html[data-theme="dark"]` inside `@media screen` (so the two print-a-report screens
keep their paper), and an inline script in the root layout sets the attribute before the first paint. Nothing
is sent to the server, no migration is involved, and the starting appearance stays the reviewed light one —
following the operating system happens only when somebody picks System.

**Measured here on 2026-10-21 for those two changes: 14 suites, 1 254 checks, 0 failed** —
`migration_test.py` 196 → **211** (fourteen revisions, the chain ending at `0013_student_age`, the column
proved on a fresh build, on a running database, on the offline diff and after a downgrade, and in a new
section that boots the app's own `add_missing_columns` before `alembic upgrade head`, which is the ordering
that would otherwise die with `duplicate column name: age`), `conversation_facts_test.py` 25 → **49** (a
stated age kept as the number, Devanagari digits, the 3 and 99 ends held, 2 and 200 ignored, every band
boundary derived rather than chosen, and the route-level patch above), plus `smoke_test` 104, `login_test` 62,
`guest_session_test` 71, `tenancy_test` 227, `erasure_test` 83, `security_test` 146, `clerk_auth_test` 106,
`assessment_test` 117, `report_pdf_test` 69, `exams_test` 91, `admin_test` 135, `serverless_guard_test` 10, and
`schema_fit_check.py` again "182 seeded values measured, 0 columns too short". **Five suites were not run for
this change**: `tts_provider_test`, `email_test`, `email_flow_test`, `payments_test`, `study_abroad_test` —
none of them touches the profile or the palette, and the live-credential ones carry the same caveats as the
rows below. `npx tsc --noEmit` and `npx eslint src` both exit 0 (the age field's first draft copied its prop
in an effect and `react-hooks/set-state-in-effect` refused it; it now resets while rendering). The Hindi
validators: **2 016 keys**, 1 488 candidates, 424 untranslated (unchanged — the six new age strings and the
theme labels are all in the dictionary), 0 prose literals missing, and the conflicting-duplicate count went
from 4 to 3 because a dead `Age` entry in `chat.ts` — left over from when the chat's saved-fact chip was the
column name — would otherwise have fought the new field label over one key. `npm run build` was again **not**
run, for the reason two rows below.

**Seen in a real browser on the running app (`frontend` on :3100, `backend` restarted on :8100 so
`schema_sync` added the column to the dev database):** onboarding as a student → Settings → My profile → the
Age field is a text input, not a dropdown → typed `14` and blurred → the dev database holds `age=14`,
`age_range='adult'` → reload and the field still reads 14 → typed `2` and blurred → the Hindi sentence
"अपनी उम्र 3 से 99 के बीच पूर्ण संख्या में लिखें।" appears with `aria-invalid`, and **no request leaves the
browser** → cleared the field, then typed 14 again → `/app/profile` reads "14 वर्ष". Theme, by computed style
rather than by eye: a fresh load with `careerguide.theme=dark` gives `data-theme="dark"`, body `#080f1c`, and
**0 of 624 elements on `/careers` still painting white**; `system` resolves to the OS (this machine reports
dark) and flipping to लाइट in Settings repaints the whole page and rewrites the key. `scripts/layout-shot.mjs`
(headless Chrome, which needed a `CG_THEME` knob to make a device-local appearance screenshotable at all)
rendered `/careers` light, `/careers` dark, `/careers` dark in हिन्दी, `/` dark, `/privacy` dark and
`/careers` dark at 375px: **no horizontal overflow, no console errors, no failed requests** on any of them, and
the screenshots were looked at — the dark palette holds on the landing page's chat mock, the amber
"what this will not do" panel and the footer. Two honest limits: the interactive browser here has no visible
surface, so 16 elements read white immediately after a *live* light→dark flip purely because their colour
transition does not advance on a hidden page — in a real window that transition completes, but this pass did
not watch it happen; and the landing page's own header carries no appearance button, so a first visit changes
theme in Settings or on `/careers`. This pass also left one test student (`users.id=51`, "Student", age 14) in
the dev database, and `careerguide.db.preflight-20261021` beside it; neither is committed.

**On 2026-10-21, after the served class range moved from 3–12 to 6–12, all 19 scripts were executed here
again: 2 055 checks run, 2 054 passed, 1 failed.** The failure is `tts_provider_test.py`'s one live call —
Google answered `429 RESOURCE_EXHAUSTED` on the free-tier request quota for the TTS model ("retry in 16h"),
which is the billing ceiling of the key this machine tests with and not a change in the code; that suite's
other 72 checks, every one of them about the request and the answer shape, passed. The three suites the
class change touches now print `assessment_test.py` 117, `admin_test.py` 135 and
`conversation_facts_test.py` 25: the instrument floors read 6, a `class-4` onboarding request and a
`class-5` profile patch are refused by the server, a career's `min_class` is bounded at both 6 and 12, the
only sub-floor row a route can still meet is legacy data (the suite writes one by hand to prove the route
still turns it away), an in-range duration is still not read as a grade, and a class below six states
nothing. `tsc --noEmit` and `eslint src` were re-run the same day and both exit 0, and the three Hindi
validators moved only as the change predicts: **2 004 keys** (the three `Class 3` / `Class 4` / `Class 5`
labels left with the class range), 1 486 candidates and 425 untranslated unchanged, 0 prose literals
missing. `npm run build` was again **not** run, for the same reason as the row below.

On 2026-10-20, after the exam catalogue moved onto the backend, the read routes got their own throttle
and `DELETE /api/users/me` was added, every one of the 20 scripts above was executed here: 19 suites,
2 054 checks, 0 failed** — plus `schema_fit_check.py`, which answers "182 seeded values measured, 0
columns too short" rather than a pass count. Two suites are new (`exams_test.py` 91, `erasure_test.py` 83)
and four counts moved: `security_test.py` 105 → 146 (the shared read bucket: which routes are exempt,
which are counted, and that a read is still answered when the counter store cannot be reached),
`migration_test.py` 161 → 196 (the chain now ends at `0012_user_erasure`, and the suite's table-by-table
comparison runs over the two new tables and the new column), `guest_session_test.py` 40 → 71 and
`login_test.py` 60 → 62 (the refresh ceiling, and the session cookie — each now proved from a
cookie-bearing client and a bare one). `tts_provider_test.py` printed its one `SKIP` again: no Azure key in
this shell, so nothing was sent to Microsoft. `tsc --noEmit` and `eslint src` were re-run the same day and
both exit 0. `npm run build` was **not** re-run for this row, because it writes `.next` while the dev
server on this machine is the one being clicked through — so the route count below is still the 2026-10-18
measurement and does not include `/app/admin/exams`.

The two runs below are kept because the table rows still carry their dates wherever a count did not move.

On 2026-10-19 the whole battery ran again with the operator's dashboard in place: **17 suites, 1 802
checks, 0 failures**. That is the 16 portal-era suites re-run end to end (1 668 checks, with
`migration_test.py` counted at its own latest run of 192 because `0008_admin_audit` has to round-trip
too) plus `admin_test.py` (134). A row whose count did not move keeps the date its own sentence was last written rather than
being restated.

**On 2026-10-20 every one of the 18 scripts above was executed again on this machine, after the
study-abroad legal rewrite and the Hindi public pages: 1 802 checks passed, 0 failed, and not one count
moved.** That is the expected result — nothing in `backend/` changed — and it is written down because it
is also the honest description of the state: the backend is a month behind the frontend on this working
tree, which is uncommitted, so CI has never seen any of it (§7). `tsc --noEmit`, `eslint src` and
`npm run build` were re-run the same day and all three are clean.

Then the schema was fixed the same day: `0000_baseline_schema` went into `migrations/` so that
`alembic upgrade head` builds all 39 tables on an empty database with no `create_all` first, and
`migration_test.py` was rewritten to prove that (three builds instead of two, plus the baseline on its
own). The battery ran again after that: **17 suites, 1 771 checks, 0 failed** — every other suite's
count identical to the run above, only `migration_test.py` moved (192 → 161, because the new suite
asserts fewer, larger things and drops the checks that were specific to the old ordering).

| Suite | Result |
| --- | --- |
| `smoke_test.py` — consent gates, server-side ownership, conversations, the AI provider call against a stand-in service, recommendations, plans, reports, transcript deletion, logout | **104 passed, 0 failed** · 2026-10-18 (re-run) |
| `login_test.py` — come-back codes (still on the server, no screen offers them) | **62 passed, 0 failed** · 2026-10-20 (60 → 62. The suite now keeps two clients apart: the one that has a cookie jar full from its own sign-ins, and a bare one. Without that split an "anonymous request" check was being made with a session in hand and passing for the wrong reason) |
| `guest_session_test.py` — the device-id entry path: new vs known device, one device one account, token still guards every read, start-over rotation, cross-device isolation | **71 passed, 0 failed** · 2026-10-20 (40 → 71, from two sections added when sessions moved off `localStorage`: renewal that happens quietly and only up to the ceiling, and the session travelling in a cookie the page cannot read) |
| `conversation_facts_test.py` — the guide asking for facts inside the chat | **24 passed, 0 failed** · 2026-10-18 (re-run) |
| `assessment_test.py` — the three questionnaires: the bank's shape in both languages, one sitting per student, autosave and resume, an answer key that never appears in a response, scoring from answered areas only, `null` instead of 0 where there is too little to score, bands that describe the set rather than the child, careers drawn only from the app's own catalogue, and the ownership rule that keeps another student's result unreadable | **117 passed, 0 failed** · 2026-10-23 (re-run for the plan column, which is written at submit inside this suite's own finish path; 116 → 117 arrived with the typed-age round and the row had not been re-dated since) |
| `migration_test.py` — the schema built **three** ways: from an empty database through `migrations/`, from `0000_baseline_schema` up, and from `app/models.py` through `create_all`, then compared column by column (name, type, nullability, FK, `ON DELETE`), plus constraint and index names, a `downgrade` that actually runs, the `stamp` path for a database the app prepared by hand, and the `0009` column widening against a row that already overflows it | **218 passed, 0 failed** · 2026-10-23 (60 → 77 → 175 → 185 → 192 → 161 → 196 → 211 → 213 → 218. It grew again for the same
reason it shrank: the chain now ends at `0012_user_erasure`, so the three builds each run their
table-by-table comparison over `exam_groups`, `exams` and `users.erased_at` too, and two ordering checks
name the new revisions — the erasure date builds on the exam catalogue rather than replacing it. The chain
now ends at `0015_result_roadmap`, which adds one nullable `roadmap_json` to the `results` table — so the
column-by-column comparison of `results` across all three builds now has the plan's home in it, and the
`0014_resume` → `0015_result_roadmap` ordering check proves a stored plan builds on the CV table rather than
replacing it. Earlier: `resumes` is one of the tables compared column by column across all three builds,
and an ordering check proves the CV table builds on the stated age rather than replacing it. Smaller
because the suite was rewritten, not trimmed: the comparison now prints one result per table covering all three builds where it used to print one per table per build, and the checks that existed to prove the old `create_all`-first ordering were replaced by one that proves the opposite — `upgrade head --sql` from nothing creates 38 `CREATE TABLE`s with `users` before its dependants. Money shape is still covered: `subscriptions` keyed by `user_id` alone, `payments.order_id` unique) |
| `report_pdf_test.py` — the printed report in three parts. **The copy**: every string the renderer asks for exists in `backend/data/report_copy.json`, in English and हिन्दी, and no printed page contains a run of Japanese/Chinese/Korean/full-width characters that would mean a glyph fell back to boxes. **The shaping**: Hindi is put through the same HarfBuzz call ReportLab makes, and the check is on the output — 10 Devanagari codepoints collapse to 6 conjunct glyphs, Latin stays plain (`office` must come back as six letters, not one `ﬃ` ligature, because a family copy-pastes what it can see), and the counterfactual `liga=True` still produces the ligature, which is what proves the switch is doing the work. **The routes and the file**: `401` without a token, `403` for a parent, `404` for a stranger's sitting, `409` for a sitting that is not finished, `201` on the first render and `200` with `generated: false` on the second, the filename, no PDF bytes inside any JSON response, the download's content-type / `%PDF-` header / `%%EOF` trailer / byte length / `Content-Disposition`, the page count between 5 and 9, the list, and two different bad ids answered identically. Then the two rules that matter for a child's data: a new questionnaire invalidates the stored file, opening the same report from a *different* result page returns the *same* row rather than a second copy of the answers, and deleting the sittings inside it takes the file with it (SQLite needs `PRAGMA foreign_keys=ON` for that, so the test turns it on and asserts the cascade instead of trusting the DDL) | **69 passed, 0 failed** · 2026-10-18 |
| `tts_provider_test.py` — SSML escaping, key as header, error messages, provider choice, `/api/health`, plus a real Gemini synthesis | **72 passed, 1 failed, 1 skipped** · 2026-10-23 — the one failure is the single check that needs the outside world: the live Gemini call answered `429 Too Many Requests` again, the free-tier request quota on the key this machine tests with (the same answer on 2026-10-21 and 2026-10-22), and it is printed as a failure rather than a `SKIP` because a key *is* configured. Its live Azure call has no key in this shell and prints `SKIP` rather than pretending. Every other check in the suite is about the request and the answer shape and needs no network; the shape checks ran again today and all 72 passed. Recorded green on 2026-10-18 (**75 passed, 0 failed, 1 skipped**, when the same Gemini call returned playable audio) |
| `serverless_guard_test.py` — the no-database shape | **10 passed, 0 failed** · 2026-10-18 (re-run) |
| `clerk_auth_test.py` — the optional email sign-in, run against a stand-in that answers the way Clerk's API is documented to answer. The status call tells the truth when no keys are set; verification goes to Clerk's own endpoint with the server key and a timeout, and an unreachable Clerk is a `502` that says nothing changed; linking needs **this app's** bearer token *before* Clerk is consulted, so a stolen Clerk session grabs nothing; attaching the same identity twice changes nothing, and a second account that tries it gets a `409` naming the screen that fixes it; exactly two columns are written and no column here could hold an address; `enter` opens the same account with a freshly issued token; unlinking leaves the browser working and the email finding nothing; the webhook refuses unsigned, wrongly-signed, replayed and tampered deliveries without clearing a pointer, accepts a genuine `user.deleted` by clearing only the pointer, and stops accepting everything the moment its signing secret is off; and the finished-sitting list the profile screen reads is the student's own, newest first, with the "24 of 30 answered" counts and each questionnaire's own language | **106 passed, 0 failed** · 2026-10-19 (re-run). What it cannot prove is the part families would ask about: no Clerk project is attached to this build, so the live widget, a real token verification and a genuine Svix-signed delivery remain **unverified** (§4) |
| `security_test.py` — the hardening pass, run with the throttles **on** and turned down to two and three a minute, so a limit is provable in three requests instead of twenty-one. The bucket is the caller's session, not their street: the key is a sha256 of the bearer token — never the token, so nothing logged or cached can carry it — two students on one machine get two headrooms, and a call with no session yet falls back to its address. Every rule is parsed at startup: `20每分钟`, `plenty per minute`, `20`, `per minute` and `-5 per minute` are refused rather than silently switching the guard off. A `429` is a sentence a child can read, with a `Retry-After` equal to the window and no library jargon in it, and a throttled call never reaches the speech vendor and never says whether a come-back code was right. CORS: `*` is dropped, whitespace and trailing slashes normalised, the site's own public URL folded in once, a stranger's `Origin` given no header, and nothing allowed with credentials. Input: a 15-character device id, an 81-character name, an unknown role, an age band nobody was offered, a 49-character interest, an empty interest, an extra key in a body, and `javascript:` / `data:` / relative text in a plan link are each refused — while `https://ncert.nic.in/…` still saves; `?limit=-1` on the journey feed is refused instead of meaning "every row"; a truncated, punctuated or empty-token bearer header is refused before a database lookup | **146 passed, 0 failed** · 2026-10-20 (105 → 146 once the shared read bucket arrived: which catalogue
routes are exempt from it, which reads are counted against it, that an exemption matches a path segment
rather than the start of a string, and that a read is still answered when the counter store cannot be
reached — then re-counted the moment the store comes back). It also caught one drift outside its own scope: `conversation_facts_test.py` had been posting `{"mode": "chat"}` to `/api/conversations`, a key no screen has ever sent and no handler reads — the strict schema answered it `422 extra_forbidden`. The test was corrected to `{"kind": "chat"}`, which is what `frontend/src/lib/api.ts` sends |
| `payments_test.py` — the money paths, against a stand-in for Razorpay that records what the server asked for, so it needs no key and no network. **The price list is arithmetic, not a claim**: yearly is the monthly times twelve minus the stated discount, the savings percentage is computed, and nothing is typed into a constant. **A server with no keys says so in words** — the routes answer, the flag comes back, and the provider is never contacted. **Signatures**: the only thing that turns a request into money, checked against a body someone edited. **Ordering**: the amount comes from the plan and never from the caller, so a body naming its own price is ignored; an unattested adult gets refused *before* the provider is asked for an order at all. **Verification**: a plan unlocks on a signature, not on a say-so — a callback that claims success without one changes nothing, a replayed confirmation grants one period and not two, and a failed payment leaves the account where it was. **The webhook**: unsigned, wrongly-signed and tampered deliveries are refused, `payment.captured` for an order that isn't this account's is ignored, the same event delivered twice grants the days once, and everything stops the moment the signing secret is turned off. **Giving up a paid period** is a confirmed action. **Limits, when a deployment switches them on**: the fourth chat of the day is refused with a sentence that points at the price list and promises nothing already made is lost, a disclosure of harm is answered whatever the plan and still counts as the chat it was, an unfinished questionnaire can always be resumed, one questionnaire finishes on Free and the second is where the allowance ends, the careers catalogue, streams and exams stay free, and a school **licence grant leaves no payment row pretending money arrived**. **Fairness**: a guardian inherits the family's paid period, an ended period is not a plan any other account can still read, the chat day rolls over at IST midnight rather than UTC, and — the check this whole feature exists to make — **the recommendation a child is told is byte-identical before and after someone pays for it** | **172 passed, 0 failed** · 2026-10-18 (new suite). What it cannot prove is in its own docstring: no real order has ever been opened and no payment has ever been captured, because that needs a test-mode key on this deployment (§5, "Still needs your own testing") |
| `email_test.py` — the mail layer with no key and no network: the transport stubbed the way Razorpay's is, so a deployment with no `RESEND_API_KEY` answers "not configured" instead of pretending, and an address never reaches a log line — neither fact is observable against a real provider | **113 passed, 0 failed** · 2026-10-19 (re-run) |
| `email_flow_test.py` — the decisions around the transport: an address that has not been opened at cannot receive anything (checked from the database as well as from the response), permission is per purpose rather than one global yes, and the outbox queue retries, ages and stops without ever sending blind | **89 passed, 0 failed** · 2026-10-19 (re-run) |
| `study_abroad_test.py` — the directory's credibility: every seeded institution comes back `verified: false` with empty fee, intake and deadline fields across **every row** rather than a sample, an enquiry needs a tick before it needs a row, and the admin screen refuses a non-operator | **166 passed, 0 failed** · 2026-10-19 (re-run) |
| `tenancy_test.py` — the portals, arranged around the five things worth proving rather than around the route list. **An invitation grants nothing, and that is a database fact**: a waiting row holds an address and a digest and has no `user_id`, which is checked by reading a roster as the invited account *before* it accepts and again by watching which columns are NULL on either side of the accept. **A role inside an organisation is not a role on an account**: `counsellor` and `school_admin` come off the membership row on every request, a student invited as a school's counsellor is refused in words, and a school's administrator is not the platform's administrator and cannot close their own portal. **Five is a cohort and four is a naming exercise**: every breakdown under the floor is dropped *and named* in `hidden`, so a head teacher sees the guard fire. **A counsellor's caseload is not their school's intake**: one `client_is_visible` rule limits the roster and the analytics together, and a note is readable by its author alone until the author shares it. **Nothing about a child's work leaves these routes**: no response body fetched anywhere in the suite may carry a key containing `answer`, `score`, `transcript`, `report` or `conversation`. The mail is stubbed, so the join links are read back out of the captured payloads and the accept route is tested through its real input rather than an invented token | **227 passed, 0 failed** · 2026-10-19 (new suite, run with the portal screens in place). What it cannot prove is the part a school would ask about: no invitation has ever been mailed for real here, and no portal subdomain has ever resolved outside this machine (§4, "School and counsellor portals") |
| `admin_test.py` — the operator's side, arranged around the six things worth proving about a screen that runs the whole site rather than around the route list. **The flag and what cannot ask for it**: a student, a parent and a *school's own administrator* are refused on every operator route, and the sweep is generated from `app.openapi()["paths"]`, so a route added after this file was written is refusal-tested the day it is registered; no request body declared anywhere in the API has a field that could grant `is_admin`. **A list of people that holds no person's data**: the fixtures plant known sentinel strings in a child's message body, a device id, a come-back hash and a family's enquiry text, and at the end every one of the 47 operator responses the suite fetched is searched for them — a field-name check alone would not notice a count that was really a transcript. **Two pairs that must never be added together**: a reply written by the demo script is not the work of a model, and a payment made with a test key moved no money, so each pair is asserted to split, and the money is asserted in paise against figures the fixtures know. **One log row per change and none for a read or a no-op**, including the grants made by `scripts/admin_grant.py`, which are logged with no actor account and `origin="script"` — a log that recorded only requests would imply the only way in was through a page. **Nothing on the screen can lie**: an answered questionnaire item refuses an edit, a career entry refuses to have its `needs_verification` flag switched by a form, the blog route says it cannot edit the blog and has no write route behind it, the deployment route holds no key value, the log has no delete, and an operator can neither demote nor close their own account, cannot leave the flag on an account that cannot sign in, and cannot lock the site out of itself when they are the last one holding it. Also: an address cannot be used to find out whether an account exists, and the throttle covers the mutating routes only — `GET /api/admin/summary` is deliberately unthrottled so reloading a dashboard cannot lock an operator out of their own screen | **134 passed, 0 failed** · 2026-10-19 (new suite, re-run after the deployment-screen fix recorded below — still 134). What it cannot prove is that a screen *renders*: the operator's pages were then walked in a real browser against the running containers, and that pass is the row below |
| `exams_test.py` — the exam catalogue after it left the frontend bundle, arranged around the one promise the section makes: **a figure without a source does not exist**. The seeded 9 doors and 11 exams come back with no date and no fee — in the response *and* in the database, which is the only place the second claim can be checked. An anonymous call to an operator route is a `401`, a student's is a `403` that names who may change it, and an operator's own read is a superset of what a student can see. A date or a fee is stored **withheld** until the operator ticks the row as verified; un-ticking withholds it again while the operator still reads it; clearing a verified row's source is refused in words, because the page it was read from is part of the record; a value that is not a URL is refused as a source. `PATCH` changes only the fields it was sent, a hidden row stays hidden from the public list, a door with an exam in it refuses deletion, a missing row is a `404` and nothing else is touched by the attempt. Each of create / update / verify writes exactly one `audit_events` row, with the actor and the changed fields. Then the two throttles, proved separately and with the counters reset around the functional calls so no stale bucket fakes a pass: six admin writes in a minute and the seventh refused with a `Retry-After` and the sentence that what was already saved is saved, while the public list survives 30 reads and it is `/api/exams/admin` that stops | **91 passed, 0 failed** · 2026-10-20 (new suite). What it cannot prove is whether any date or fee in the catalogue is true: no row is ticked, and a tick is a human reading an official notification (§4, "Entrance exams") |
| `erasure_test.py` — `DELETE /api/users/me`, the route that has to work from the session alone because this app asks for no password and sends no confirmation email. **The response's numbers are checked against the database**: the fixture writes a conversation with three messages, an assessment with its answer and its result, a career report, the PDF printed from it, a plan with an item, saved careers, a recommendation, journey and interest rows, settings, a consent, a queued mail and a resume the student had written; every per-table count in the answer equals what was really there, and then every one of those tables re-counts to zero — including the child rows that hang off them (messages, answers, plan items, results). **The row survives and stops being a person**: `role='erased'`, no name, closed, not an operator, no device digest, no come-back code, no address, no linked sign-in, holding only the date it was erased on; a payment and a subscription written afterwards still point at that id, because a ledger the payer can delete is not a ledger. **Every session ends, not only the one that asked**: two tokens on two devices both return `401` on the profile, on a refresh and on a second erasure, the response clears the cookie, and the same device id now answers `known: false` — a new visit makes a new account rather than finding this one. **Nobody else is taken with them**: a parent's erasure counts every link they held, and each child keeps the account, the conversation, the message inside it, the profile and a working session; a referred student's erasure removes their portal seat *and the counsellor's note about them*, counted separately because somebody else typed it, while the counsellor keeps the account, the seat and the sign-in. **An operator is refused** (`403`) with the reason, and the refusal erases nothing. Then the copy the screen shows: the survivor list is the route's own list, and the done-message says what happened to this browser without claiming anything about a law | **85 passed, 0 failed** · 2026-10-22 (83 → 85: the fixture now writes a `resumes` row and checks the response counts it, because `DELETE /api/users/me` names `resume` in its own removal list. Original run 2026-10-20 — and it found the one real gap in the route as first written: a study plan's **items** were being left behind, because SQLite carries `ON DELETE CASCADE` in the schema but does not switch it on, so the route now deletes them itself and reports them as `study_plan_items`). What no test here can prove: that a dump taken *before* an erasure still contains the deleted rows. The app keeps no copy to restore from — `backend/scripts/backup_db.sh` is the operator's, and an erasure promise means a retention decision about those files (§1, "Database backup") |
| `resume_test.py` — the CV and the ✨ button, written against the two failures this feature can actually have: one account reading a child's marks, and a list called "AI suggested" when no model was consulted. **Who may reach it**: `401` with no session on all three routes, and a parent gets `403` on the read, the write *and* the suggester — the last one checked before the provider is called, so a screen a family cannot use cannot spend the site's money. **Ownership comes from the session**: the row is looked up by the id the token proved, so a body naming another `user_id` writes the caller's own document or nothing; a second student gets their own empty CV rather than the first one's, and the two rows are checked to be keyed to the right accounts. **A first visit is `200` with three empty lists and no date**, not a `404` the page has to invent a story for, and merely looking writes no row. **Saving replaces**: eight skills become two and `GET` returns those two, because a row deleted on screen has to be gone when the tab reopens; a Hindi document comes back character-for-character; the whole thing can be cleared. **Bounds a body cannot talk past**: the lists at their limit (20 skills) accepted, one over refused, and **a refusal leaves the saved document alone** rather than half-writing it. **Then the suggestions, in both directions.** With `AI_PROVIDER=demo` the answer is this app's own career catalogue, `demo_generated: true` says so, each item fits the form that saves it, no skill claims a level the student never picked, a role the catalogue has no profile for is given the general list *instead of* a guess dressed up as a match, and a career that does match is named as the source so the student sees what it was matched to. With a stand-in provider that answers the way the documented API does, `demo_generated` is false and the provider is named — and the same stand-in is then made to fence its JSON, trail a sentence after it, return 40 skills, return nine projects, invent a level the app does not offer, answer in prose, answer with an empty list and answer with an array where an object was promised. Every one of those is bounded to the schema's own limits (8 skills, 5 projects, prose cut to the field's width) *before* a student can save it, and the three ways a provider fails are three different honest sentences — unreachable, unreadable, empty — each still handing the student a usable list rather than a `500`. A Devanagari job title is asked of the model in Hindi, because that is what the student wrote. The prompt itself is checked for the rules that keep it a twelve-year-old's list (no paid bootcamp, no invented project), for the JSON contract the parser reads, for the completion budget a reasoning model needs before it can answer at all, for the key travelling as a header only — **and against the CV that account actually holds**: a sentinel school name, a phone number and a project line are saved, the stub's recorded requests are searched for all three, and none of them is there, because `/privacy` tells a family that only the job title they type leaves the machine and that sentence has to be tested rather than read. **And the CV goes when the account does**: the erasure response counts `resume`, the table has no row for that account afterwards, and the other student's document is untouched | **84 passed, 0 failed** · 2026-10-22 (new suite, written with the feature) |
| `roadmap_test.py` — the plan sitting on a result, checked against the three ways this feature can lie: a gap invented out of nothing, a model's words passed off as the app's, or a student's answers reaching a provider they were promised they would not. **Who may reach it**: `401` with no session, `403` for a parent on the read *and* the ✨ rewrite — the refusal lands before the provider is entered, so a screen a family cannot open cannot spend the site's budget — and a stranger's result is the same `404` it always was. **A finished sitting arrives with a plan already written**: `roadmap_json` on the row, the same object in the response, aimed at the career the result already named first. **Unknown is never weak**: an area with too few answers produces no score, no number and no gap, and lands in `unmeasured` with its own sentence. **A gap the answers actually support** — three sittings chosen from this app's own career notes so that every reason a gap can carry is real at least once: an area answered at the bottom of the scale (`low`), one answered at the top that still arrives third behind two stronger areas (`middle`), and one never answered (`unmeasured`); the strengths cap, both summary branches and week two's "first area named in the gap above" are checked against the shapes that produce them rather than against an empty list. **The same plan in हिन्दी**: one stored, language-neutral shape rendered into sentences in either language, and no Devanagari run appearing on the English read. **Ownership**: rewriting another account's plan is refused and leaves the row exactly as it was. **Answers that support no plan** come back `roadmap: null`, which is the state the page's own card exists to explain. **Then what the provider is told** — every request a stand-in recorded is searched for a school name, a phone number, a student's name, a project line and one of their actual answers planted on that account, and none of the five is there, while the area names, the `out of 100` numbers and the career are. **The model's own plan arrives inside bounds it cannot talk past**: exactly four weeks, titles and steps inside the field widths, gaps and strengths non-empty, prose that fails any of it answered *unusable* with the rules plan still standing, and the three ways a provider fails are three different honest sentences. **The guide is handed the same four weeks**: `plan_of` on a message puts the rendered plan into the system prompt in the language the student is reading, a `plan_of` naming another account's result is a `404`, and the note carries the strong areas always and the gap line only when a gap exists — a guide describing a gap the page does not show is the failure that check exists for. **And the plan goes when the account does** | **205 passed, 0 failed** · 2026-10-23 (new suite, written with the feature) |
| `verification_test.py` — the four ways a "Verified" badge could appear on a card without anybody having
checked anything: the database handing a row a date, a request setting the field, a shell being given a date,
and a shell being given nothing but a link. **Nothing arrives certified**: the 596 catalogue rows the app
seeds itself land with no page and no date, and 0016's three columns are proved nullable with no default.
**No request can light it** — `needs_verification` is refused as not editable, `source_url` and `verified_at`
are refused by the `extra="forbid"` write schemas, a university's `verified` is refused without a source, and
a student is refused the admin route outright. **The script cannot be handed a date**: `attest --help` has no
date option, `--verified-at` is an unrecognised argument, `--read` is required, and there is no `--all`, no
`--from-csv` and no `--since`. **Eight refusals, each followed by a re-read of the row**: an http address, a
host that is not on the internet, a domain the list does not recognise, a string that is not a URL at all, a
note too short to name a fact, a note of only spaces, an id naming no row, and a word where a scheme's number
belongs — every one of them leaves the columns exactly as they were and writes no audit entry. **The write
path is measured, not assumed**: the URL is stored
verbatim, the date equals today in UTC and nothing else, the flag flips with it, one `audit_events` row
appears with a null actor and `origin="script"`, its `subject_id` is the identifier the operator typed, and a
detail over the column's 400 characters is cut with the URL kept whole. **Half states are named as the
impossible thing they are**: a page with no date is printed as such rather than counted as checked, and
`unattest` clears all three columns and logs the taking-back. **`worklist` writes nothing** and lists exactly
the rows the database itself marks unread | **72 passed, 0 failed** · 2026-10-23 (new suite, written with the feature) |
| `schema_fit_check.py` | 182 seeded values measured, **0 columns too short** · 2026-10-20 |
| `tsc --noEmit`, `eslint src` | clean · 2026-10-18 (re-run with the pricing page, the billing screen, the three `components/pricing/*` files, `lib/checkout.ts` and `lib/money.ts` in place; both exit 0. Two things this caught on the first pass and both are worth naming, because they are the kind of bug these two tools exist for: a `react-hooks/purity` error — the checkout dialog was computing its own expiry date with `Date.now()` during render, which would have printed a date the server had never agreed to, so the line is gone and the billing screen shows the server's answer instead — and an unused-parameter warning on a FAQs helper that took a translator it never needed, which became a module-level list) |
| `npm run build` | **63 page routes** in `app-path-routes-manifest.json` · 2026-10-22, exit 0, counted with `node -e "Object.keys(require('./.next/app-path-routes-manifest.json')).length"` and `/app/resume` found in that list. The 60 in the rest of this row was measured on 2026-10-18 and has not been re-derived — five routes have arrived since (`/welcome`, `/app/resume`, `/app/admin/study-abroad`, `/account/connect`, `/account/enter`), which does not add up to 63, so the older figure is left exactly as it was written rather than quietly corrected to a number nobody counted today. (40 when this row was first written, 54 with the portals; the operator's dashboard added seven — `/app/admin` itself plus `dashboard`, `users`, `content`, `leads`, `settings` and the pre-existing `study-abroad`, all of which `.next/server/app/app/admin/` now holds a build output for). The three portal routes build as themselves: `/school/dashboard` and `/counsellor/dashboard` come out `◐` — Partial Prerendered, because each reads `?portal=<slug>` and the request headers at request time, which is also why both carry `export const instant = false` — and `/join` comes out `ƒ`, because its token arrives in a query string. Pages (including `/_not-found`) plus the dynamic `/api/contact`, everything else prerendered static. Two were new at the last row: **`/pricing`** and **`/app/billing`**, and both come out `○` (static) — the pricing page asks the backend nothing at build time and renders whatever `GET /api/payments/plans` says once it is open in a browser, so the whole set builds with **Clerk's and Razorpay's keys both absent**, which is the state this deployment is actually in. `/app/reports/[id]` stays in that table as a Partial Prerendered page, next to `/app/assessments`, `/app/assessments/[type]`, `/app/assessments/result/[id]` and `/app/profile`, alongside `/app/streams`, `/app/exams`, `/legal`, `/privacy`, `/terms`, `/refund`, `/disclaimer`, `/about`, `/contact` · 2026-10-18. The build still prints `ƒ Proxy (Middleware)` — Next 16 renamed that file convention, `src/middleware.ts` is still the name that compiles, and it is the one that now carries the Razorpay hosts. **Re-run on 2026-10-23** after the plan on a result landed: exit 0, still **63 page routes**, because the feature adds none — its two cards render inside `/app/assessments/result/[id]/page`, one of the Partial Prerendered rows above |
| The five response headers, in a real browser on **both** servers | `curl -D` against the dev server (`:3000`) and against a production build (`next start` on `:3100`) each return `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy` on `/` and on `/app`. Dev's policy carries `'unsafe-eval'` and three `ws://` dev-socket hosts; production carries neither, because `NODE_ENV` decides — that difference is the whole reason both were measured instead of one. Inside the page a `securitypolicyviolation` listener recorded **zero** violations while it opened a conversation and read a real reply through `connect-src`, played a `data:` WAV through `media-src`, rendered a `blob:` document in an `<iframe>` under `frame-src`, and posted a same-origin form to `/api/contact`; the page's own React root was present, so the policy did not stop hydration. The single error the production port produced was a **CORS** rejection, not a CSP one: `http://localhost:3100` is not in `CORS_ORIGINS`, which is that guard doing its job · 2026-10-18. Not re-walked by hand this round: the `/app/reports/[id]` preview and `/app/call` screens — the blob preview was proved as an equivalent in-page `<iframe src={blob:…}>`, not by opening that screen |
| `/pricing` and `/app/billing` in a real browser, as a student, with Razorpay's keys absent | `scripts/layout-shot.mjs` swept both routes at 375 and 1440 px in English and हिन्दी: 2 × 2 × 2 = **8 shots, no horizontal overflow, no console errors, no failed requests** · 2026-10-18. Then the same two pages were walked with a live student token and read as text, in **three account states** the suites never show a human: an account that has never paid, an account whose paid period has run out, and an account holding a school's granted licence. The price list is the server's: ₹0 / ₹299 / ₹2,499 with the yearly card striking ₹3,588 and printing "save ₹1,089" and "about ₹208 a month" — all four numbers computed, none typed into the page; 8 questions, 9 comparison rows, and exactly two disabled "Upgrades are not open yet" buttons (the School plan is a link to /contact, not a button that goes nowhere). `curl -D` on `/pricing` shows the policy that has to hold a checkout: `script-src … https://checkout.razorpay.com`, `frame-src 'self' blob: https://checkout.razorpay.com https://api.razorpay.com`, the same two hosts in `connect-src`, and `permissions-policy: payment=(self "https://checkout.razorpay.com")` — camera, geolocation, USB and MIDI still closed to every frame. **Pressing "Switch to the free plan" on the granted account was done for real**: the modal named what that account gives up, the route answered, the toast read "You are on the free plan now.", and the card went back to Free with its limits and nothing deleted. Four things this pass found that 172 backend checks could not, because they are all *rendering* claims rather than data claims: **(1)** the billing screen printed "The paid period on this account has ended…" for a student who had never paid anyone anything — `active: false` means "no paid period is running", which is also true of a fresh Free account, so the sentence now needs the lapsed plan's name as well; **(2)** it wore a "Test mode — no real money" badge on a deployment that cannot take money, because `test_mode` is deliberately the fail-safe answer when no key exists at all — the badge is now gated on `payments_enabled`, and the pricing page's equivalent was already correct; **(3)** it explained that "the buttons above that would take a card are disabled" on a screen with no such button on it, which is now two different sentences for the two states; **(4)** the lapsed line printed the raw token `pro_yearly` where a family would read a plan name, the same class of bug as a PDF cover printing `class-9`, and it now goes through the price list. What this pass still could not do: open Razorpay's card sheet. With no keys on this server every entry point to it is disabled on purpose, so `checkout.js` loading, the frame rendering under this `frame-src`, and the callback→verify→unlock round trip remain **unverified** — see "Still needs your own testing" below |
| `scripts/layout-shot.mjs` — 8 routes (dashboard, streams, exams, careers, settings, privacy, terms, contact) at 320, 375, 768 and 1280 px, **in both English and हिन्दी** | 8 × 4 × 2 = **64 shots, no horizontal overflow, no console errors, no failed requests** · 2026-10-16 |
| `scripts/layout-shot.mjs` — the legal set (`/`, `/legal`, `/privacy`, `/terms`, `/contact`) at the same four widths, both languages | 5 × 4 × 2 = **40 shots, no overflow, no console errors, no failed requests** · 2026-10-17. The rewritten 16-section `/privacy` was then swept on its own: 4 widths × 2 languages = **8 shots, no overflow, no console errors, no failed requests** · 2026-10-17 |
| `scripts/layout-shot.mjs` — the trust set (`/terms`, `/about`, `/contact`, `/refund`, `/disclaimer`, `/legal`, `/`, `/onboarding`) at 1440 and 375 px, English and हिन्दी | **14 shots, no horizontal overflow, no console errors** · 2026-10-17. Each reports 4 failed requests: the session prefetch to the FastAPI service on `:8000`, which was not running for this sweep — these pages need no backend and rendered correctly without it |
| `scripts/layout-shot.mjs` — the three assessment screens (`/app/assessments`, `/app/assessments/interest`, `/app/assessments/result/3`) at 320, 375, 768 and 1280 px in English, and the same three at 320 and 1280 px in हिन्दी, each with a live student token | 12 + 6 = **18 shots, no horizontal overflow, no console errors, no failed requests** · 2026-10-17. The 320 px Hindi result page was also looked at as a picture, not only as a report: the radar, the five banded areas, the five careers and the caveats block all stack inside the window |
| The assessments in a real browser, as a student and then as a parent | Interest: 13 of 30 answers → submitted → result showing 43 %, three scored areas and five careers. Aptitude: 8 of 25 → the six-sided shape is refused in favour of a bar list, one area scored (`Numbers 29/100 · 7/7`) and three printed as "Not enough answered yet" rather than 0. Personality: opened in हिन्दी, the tab closed and reopened, the two saved answers came back, the remaining 18 answered to 20 / 20 (100 %) and submitted — the result renders end to end in Devanagari, including the career names and the line explaining why each career was picked. The same result read with the interface back in English keeps its Hindi badge ("Questions were asked in Hindi") and its absolute date. A parent token on all three URLs goes to `/parent`; `/app/assessments/result/999` and `/result/abc` give the two different honest states, and neither sends a request for another student's row. **Running this is what found two bugs the suites missed**: a submit that answered 200 but never navigated, because the frontend's schema described a richer `scores` object than the scorer actually returns, and a runner that sat on "Loading this questionnaire…" forever for a parent, because the request that would fill it is the one a parent may not make · 2026-10-17 |
| `scripts/layout-shot.mjs --media=print` — `/app/assessments/result/3` at 816×1056 and 1052×724 | the first pass printed the app's own chrome with the result: the mobile header, the five-slot bottom bar, and at the wider size the navy sidebar plus the 264 px column it reserves. All four are `print:hidden` now and `app-shell.tsx` collapses to a single column in print, so the second pass is one clean page — badges, the "answered 20 of 20 on 10/17/2026" line, the chart, five areas with their `4/4` counts, five careers with their reasons and verify badges, the caveats, and the print-only provenance sentence at the foot · 2026-10-17 |
| `scripts/layout-shot.mjs --media=print` — `/terms` at 816×1056 | the print stylesheet was finally looked at: header, contents column and footer all gone, one black-on-white column, the `[CITY]` / "Not filled yet" badge and the callout borders still legible. The first pass printed the storage notice across page 1, which is why `cookie-banner.tsx` now carries `print:hidden` · 2026-10-17 |
| `/app/resume` in a real browser — screen, paper, phone and हिन्दी | Headless Chrome against the running dev pair (`frontend` on :3000, `backend` on :8100) driven from a throwaway CDP script outside the repo rather than `scripts/layout-shot.mjs`, whose injected token cannot reach a `/app/*` screen: this app's session cookie is `SameSite=None`, which Chrome will not store over a plaintext local connection, so the script seeds a student through the real `POST /api/auth/onboarding`, saves a CV through `POST /api/resume` with the bearer token, and lets the page re-enter the way a real local student's browser does — by the device id in `localStorage`. Shot at 1440 and 390 px on screen, and at print media in English and in हिन्दी: **no horizontal overflow, no console errors**, and the images were looked at rather than trusted to the probe. The paper page is the document and nothing else — the student's name, the class and the job title they aimed at, EDUCATION / PROJECTS / SKILLS, and the foot naming the print date and stating that the student wrote it and that it was not scored, verified or sent anywhere. **Three rendering defects were found this way and none of them was visible to the 83 backend checks**: (1) the printed sheet opened with the app's own "My Resume" page title, which is the second time this project has printed itself onto a child's paper (the row above, 2026-10-17) — `Screen`'s header block is `print:hidden` now, so it is fixed for every screen rather than for this one; (2) on paper the skills read `Python— Learning it`, because two flex items give the space that opens the level nothing to occupy — the row is inline again; (3) at 390 px every section description was crushed to one word per line, because `CardHeader`'s action row is `shrink-0` and no amount of `flex-1` on the text column fixes a zero flex-basis — the shared header now stacks below `sm`, and `/app` was re-photographed at 390 to check what that component had been doing to the other screens. What this pass did **not** verify, in the same words the screen would need: dark theme on this screen, the server's `422` copy rendered in the browser, the ✨ fallback sentences as *rendered* text (they are in `hi-resume` and `hi-coverage` finds nothing missing, but forcing a provider failure live means reconfiguring the provider), and a re-save after the model appended skills — `resume_test.py` proves replacement, the browser run did not exercise it. **A second pass on the same harness then drove the ✨ buttons themselves against the live configured model**, which closed three of those four: Skills went 4 → 8 with the model's lines appended *below* the student's own four, the notice under the list read "These skills were drafted by the groq model." and the toast counted exactly the four added, and **Save → reload** returned the same 8 skills and 2 projects on screen that `GET /api/resume` reported — so the re-save the route suite proves is now also the document the browser shows. The Projects button was clicked on its own (2 → 6 rows, four ideas added, the same notice worded for projects), and the screen was re-photographed with `careerguide.theme=dark`: cards, inputs, selects, the suggestion notice and the toast all paint from tokens, with no light-only surface left behind. Still unverified in the browser: the server's `422` copy as rendered text, and the ✨ notices that appear when no model answers — the screen named "the groq model" on every one of these runs because a model *was* configured, and the career-list notice and the failure notice need a provider reconfigured or forced to fail, which was not done. Every account these passes created was erased through `DELETE /api/users/me`; the only CV left on the machine is the one on the user's own account · 2026-10-22 |
| The skill gap and the 30-day plan in a real browser, as the student whose sitting produced them | Walked through the running dev pair (`frontend` :3000, `backend` :8100) in the interactive browser at its narrow (≈510 px) viewport, on the local device account, answering the interest questionnaire through the UI itself: 10 of 30 → *Finish and see the result* → the confirm dialog → `/app/assessments/result/4`. **The plan is on the page the moment the result is** — no second request and no spinner — with the gap card's two columns, the "Not measured, so not a weakness" block for the four thinly-answered areas, the career's own skill badges under "these are the skills the work itself lists", and the *Written by the app's own rules* badge with its note beside them. **✨ Rewrite this plan with AI** replaced the rules sentences with the model's own prose and flipped the badge to *groq model* ("Watch free YouTube videos on kitchen safety and basic utensils for 30 minutes each day."), and a reload kept the model's version, so it is stored rather than re-rolled per view. **Discuss this roadmap with AI Guide** opened `/app/chat?context=roadmap&result=4` with the four weeks pinned as a card, and a question about week one was answered correctly without the student describing it — a real provider reply, no demo badge. **हिन्दी**: with the interface switched, every label around the plan turned to Devanagari while the model's own sentences stayed exactly as written and the card added a *English में लिखी गई* badge — the server invents no translation. **Dark**: `careerguide.theme=dark` on both result cards and the chat's pinned plan card — surfaces, the teal and amber column headings, the numbered circles and the dashed rail all paint from tokens. **One defect found by looking and fixed**: the career's name inside the two card descriptions stayed English under हिन्दी while the rest of the page, and the "Read about …" button beside them, used the translated title — those descriptions now go through the same lookup every other career name in the app uses. What this pass did **not** verify: the page at a laptop width (this browser's viewport is pinned narrow, and `scripts/layout-shot.mjs` can no longer reach an `/app/*` route because the token it injects stopped being what authenticates a session — the two-column gap grid is `sm:grid-cols-2` on the same `Card` primitives the 2026-10-22 1440 px sweep covered, and that is a weaker claim than a screenshot); the `429` and provider-failure copy as *rendered* text (`roadmap_test.py` proves the three sentences and `hi-roadmap` holds their Hindi; forcing them live means reconfiguring the provider); and a rules plan arriving after a model plan was stored — result 4 on this account now holds the model's version, which is why its ✨ badge reads *groq model* · 2026-10-23 |
| The printed PDF report in a real browser, as the student it belongs to | From `/app/assessments/result/1` in हिन्दी: "PDF रिपोर्ट डाउनलोड करें" → `POST /api/reports/generate` **201** → `/app/reports/1`, which lists its own row, fetches `GET /api/reports/pdf/1` (**200**, `application/pdf`) and hands the bytes to an `<iframe>` as a blob URL, with Download and Delete both live. Backing out and pressing the same button with the interface in English gave `POST /api/reports/generate` **200** — the stored English file, not a re-render — landing on `/app/reports/2`, which reads "Printed in English", "careerguide-report-en.pdf — 78 KB, printed 10/18/2026 07:27 AM. It holds the 3 questionnaire(s) finished on this account.", and then "Delete this file" → `DELETE /api/reports/pdf/2` **204** → back on `/app/assessments` with only the Hindi row left in `GET /api/reports/pdf`. No horizontal overflow at the 414 px window this session offered. Two things this browser pass could *not* do and what covered them instead: the window would not give screenshots (its own viewport was 414×505 with the page hidden), so the page was verified as an accessibility tree plus the network log — every string, button and request above is one that was read or seen; and the PDF's *inside* was never looked at through the browser's viewer, it was rendered page by page to PNGs with a dev-only copy of PyMuPDF (uninstalled afterwards, and not in `requirements.txt`) and measured for blank pages, text outside the margins, ligature glyphs and unresolved boxes, and read back as text — which is how the cover printing the raw token `class-9` instead of "9" was found |
| `scripts/layout-shot.mjs` — `/app/reports/1` at 320, 375, 768 and 1280 px, in English and हिन्दी, with a live student token | 4 × 2 = **8 shots, no horizontal overflow, no console errors, no failed requests** · 2026-10-18. Two of them were looked at as pictures: the 320 px हिन्दी page stacks its badge, filename line, two buttons and preview in Devanagari without spilling, and the 1280 px English shell showing a Hindi file renders that file's cover inside the browser's own viewer — seven pages, the wordmark and the metadata table legible, and the badge saying "Printed in Hindi" rather than matching the interface |
| `/api/contact` — production build, curl matrix | valid message → `503 {"ok":false,"error":"not_configured","missing":["RESEND_API_KEY","CONTACT_FROM_EMAIL","CONTACT_TO_EMAIL"]}`; empty name + bad email + unknown subject + 4-character message → `422` with `required / invalid_email / invalid / too_short`; honeypot filled → `200 {"ok":true,"delivered":false}`; malformed JSON → `400 invalid_json`; `GET` → `405` · 2026-10-17 |
| `/contact` in a real browser | the `503` becomes an on-screen warning naming the three missing variables and the form stays put; a server-side `too_short` prints under the Message box **without erasing what was typed** — the first build called `form.reset()` on every response, which threw a rejected message away · 2026-10-17 |
| Storage consent — real browser, all three paths | Accept all → `{"state":"accepted-all"}`, four categories true; Reject all → `{"state":"rejected-all"}`, only `necessary` true; Manage preferences → the dialog opens with Necessary checked and disabled and the three optional switches off (there is nothing installed to consent to), flipping two and saving gives `{"state":"custom","necessary":true,"analytics":true,"marketing":false,"functional":true}`. Every path dismisses the banner, survives a reload and a move to another page, and deleting `careerguide.consent` brings it back · 2026-10-17 |
| `/privacy` in a real browser — contents list behaviour | served HTML has all 16 `section id`s, the four `[PLACEHOLDER]` fields and `Last updated`; `<title>Privacy Policy \| CareerGuide</title>`, description, `robots: index, follow` and a canonical all present. At 1280 px the contents column is `position: sticky` and clicking an anchor moves the page (scrollY 0 → 5 287, heading lands 32 px below the top). At 375 px the desktop column is `display: none`, the phone button reads इस पेज पर with `aria-expanded=false` and 0 links, and one click gives `true` and 16 links · 2026-10-17 |
| `/privacy` in हिन्दी — real browser | 10 100 Devanagari characters in the rendered text and **zero** long Latin prose runs left (brand names — Groq, Vercel, Gemini — and the three `careerguide.*` storage keys stay Latin on purpose); `<html lang="hi-IN">`, title गोपनीयता नीति, date 17 अक्तूबर 2026, and the rights badges and the unfilled grievance-officer card render in Hindi · 2026-10-17 |
| The profile screen and the new Account panel in a real browser, as the local student, with Clerk's keys absent | `/app/profile` rendered the account as it actually is: the identity line "This browser is the account — no email, no password", `CLASS · Not set yet`, `Age band not set`, `REPLIES IN · Hinglish (Hindi + English)`, the empty-interests sentence that points at Settings *and* at just talking to the guide, and an Assessment history section listing the three questionnaires this account finished — "How you tend to work · 20 of 20 answers · 1 day ago · हिंदी", "Puzzles to try · 8 of 25 answers · 1 day ago · English", "What you are drawn to · 13 of 30 answers · 1 day ago · English" — each one a link to its own `/app/assessments/result/N`, plus `Edit → /app/settings` and `Take an assessment → /app/assessments`. Settings → Account opens a panel whose state line says "Email sign-in is not switched on for this site", whose body names `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `POST /api/webhooks/clerk`, and whose only buttons lead somewhere real; there is no Connect button that does nothing. All four Clerk routes — `/sign-in`, `/sign-up`, `/account/enter`, `/account/connect` — serve the same written explanation instead of Clerk's widget, each with a working "Continue without an email". In हिन्दी the row state lines ("दी गई अनुमतियाँ: 3 में से 1 · इतिहास सहेजा जाता है"), the panel headings and both legal pages' new Clerk sentences render in Devanagari with no English runs left in the body. **No console errors** on any of them. What this pass did *not* re-walk: what a parent token sees on `/app/profile` (the redirect and the nav filter are code, not re-tested here), and the whole flow past a real Clerk sign-in — see §4 | 2026-10-18 |
| Hindi coverage — `scripts/hi-coverage.mjs` + `scripts/hi-prose-check.mjs` | **1 045 keys** when this row was written, **1 140** today, and the new `/app/reports/[id]` screen — 21 strings of its own — reports **0** untranslated from both scripts. The three assessment screens and their four components report **0** untranslated strings from both scripts, and so do the six trust pages (`/terms`, `/refund`, `/disclaimer`, `/about`, `/contact`, `/legal`) plus the footer, banner and preferences panel — the second script exists because a page's `SECTIONS` and `VALUES` arrays are translated through a variable, which the first cannot see. `/terms` and `/about` in हिन्दी render end to end in Devanagari; brand names and the quoted `Settings → This device → Start over` path stay Latin on purpose. **What is still English in हिन्दी: 181 strings**, on the older screens this round did not touch — `/parent` (41), `/app/settings` (35), `/app/reports` (24), `/app/interests` (16), `/app/plans` (15), `/app/journey` (14), `/app/chat` (11), scholarships, institutes, resources, onboarding and the call screen · the **181** is today's, the per-screen counts beside each name were measured 2026-10-17 and add up to 195, so treat them as the shape of the gap rather than its current total. Re-run 2026-10-18, after the profile screen and the settings list were built: three shared components now translate what they are handed instead of printing it — `SettingsRow`'s state line, `SubHeading` and `Modal`'s heading and description — which took the settings screen's own gap from 35 to **23** — what is left there is control labels (`Reply language`, `Age band`, `Display name`) and panel descriptions, which those primitives do not translate. What still stays English in हिन्दी on the newer screens is the long body text and the button labels written as JSX text, the same pattern every older screen uses. One thing inside the assessment screens does stay English in हिन्दी, on purpose and in common with every other screen here: when a request fails, the sentence printed under the error is the server's own. **Re-measured 2026-10-18 after the money screens landed: 1 140 dictionary keys, 731 candidate strings, 289 untranslated** — the jump from 181 is the pricing page (17), the billing screen (52) and the three `components/pricing/*` files (34), 103 of them, all written this round and none translated |
| PWA — the production container (`careerguide-web`, built from this tree) in a real browser | The worker installs, reaches `activated` and **controls** the page at scope `/`. Two caches, and nothing else: `careerguide-v2-assets` holds `/manifest.webmanifest` plus the four icons, `careerguide-v2-static` holds **19** entries, every one of them under `/_next/static/` (16 chunks, 1 CSS, 2 fonts) — **24** requests in the caches, **zero** of them an `/api` path and **zero** a page document, which is the assertion that matters. The offline path was tested rather than reasoned about: `docker compose stop web` (a direct `curl` on `/app` then fails with a connection error) → navigating to `/app` still renders "You are offline", with the sentence explaining that no conversation, plan or report was saved on the device, and one labelled **Try again** button → `docker compose start web`, press it, and the live dashboard returns. `<link rel="manifest">`, `apple-touch-icon` and `theme-color` are in the served HTML; `/sw.js`, `/manifest.webmanifest` and all four icons serve `200` with their real content types · 2026-10-19. Also re-run today against this tree: `npx tsc --noEmit` **0 errors**, `npm run lint` **0 errors** (1 warning, `scripts/layout-shot.mjs:109`, a tooling file). The manifest-versus-build assertion that `.github/workflows/frontend.yml` runs was executed locally against this tree's `.next` output and prints `PWA ok | start_url /app | icons 5 | routes 60` — note that this page's own CSP allows `'unsafe-inline'` in `script-src`, so the fallback document's inline listener is not a CSP exception, it is simply permitted |
| `scripts/layout-shot.mjs` — the operator's five screens (`/app/admin/dashboard`, `users`, `content`, `leads`, `settings`) at 1440×900 and 390×844, with a live operator token against the running containers | 5 × 2 = **10 shots, no horizontal overflow, no console errors, no failed requests** · 2026-10-19. The numbers on them are this deployment's own, not a fixture: 8 open accounts (8 students, 0 parents, 2 operators at the time), 4 conversations / 14 messages of which **9 are demo replies and 0 came from a model**, 4 finished questionnaires, ₹0 captured on 0 orders, 0 paid and 0 granted subscriptions, 55 careers still carrying the seed's `needs_verification` flag, 75 questions in the bank, and 1 email waiting in the outbox. The accounts list shows all 8 rows with their plan, conversation count and the operator toggle; the content screen paginates 1–20 of 55 careers with the category counts above it; the enquiries queue is empty and says so in the sentence the suite was written to require. `Deployment` reads the live process back correctly at the end of this pass — `postgresql`, the four allowed browser origins including `http://localhost:3001`, Redis holding the throttle counters, Razorpay and Clerk both absent, payments off. **Three bugs came out of walking these pages, and none of them was visible to the 134 backend checks**: **(1)** `docker-compose.yml`'s `CORS_ORIGINS` default listed port 3000 but not `${WEB_PORT}`, so a stack started on any other port served pages whose every API call was refused by the browser — the screens rendered and stayed empty, with one blocked request as the only trace; the port is now appended to the default. **(2)** `frontend/src/lib/session.tsx` left a student stranded on "Checking your account…" for good when the server *refused* the stored token: the branch cleared the token and then returned, so `status` never moved off `loading` and there was no button to escape it — it now falls through to the device check, which gives either the old profile back or the one question (verified: a revoked token lands on `/onboarding` instead of the dead screen). **(3)** `GET /api/admin/deployment` matched the database URL against three literal prefixes, and this stack's `postgresql+psycopg://` is not `postgresql://`, so the screen whose only job is to say which database is running printed `sqlite` over Postgres; the scheme is now parsed off the URL, which also labels `mysql+pymysql://` correctly and an unset URL as `not configured`. The token was written into the browser profile under `careerguide.token` by the script, on the origin, before navigation — the same key the app itself stores. What this pass did not do: the study-abroad operator screen (row 7 of the nav) was not swept again, and no operator action (grant, close, edit a career, recount) was pressed from the page — those are `admin_test.py`'s, and the flags this run set on two verification accounts have been revoked |

| Language toggle — real browser, click हिन्दी in Settings → Language and voice | nav, bottom bar, dashboard, streams, exams and the four legal pages switched on the spot, survived a reload, and `<html lang>` became `hi-IN` · 2026-10-17 |
| Interface language default — real browser, signed in as a local account whose `preferred_language` is `hi` | opens in **English** (`en-IN`, 0 Devanagari characters on the dashboard); setting `careerguide.ui-lang=hi` by hand still switches everything (6 021 Devanagari characters on `/app/streams`). The old rule that derived the interface language from the account was deleted on 2026-10-17 — a Hindi conversation must not restyle the app |
| `tsc --noEmit`, `eslint src` — the analytics/SEO round | clean · 2026-10-18 |
| `npm run build` — the analytics/SEO round | **47 app routes** — the 40 from the pricing round plus `/careers`, `/careers/[slug]`, `/blog`, `/blog/[slug]`, `/robots.txt`, `/sitemap.xml` and `/opengraph-image`. The first pass of this build **failed**: `/blog` was prerender-blocked because a page that reads the disk at request time needs `export const instant = false` under `cacheComponents`, so all four new pages now carry it; the second pass exported 47/47 with no error · 2026-10-18 |
| `curl /robots.txt` | `User-Agent: *`, `Allow: /`, **eleven** `Disallow` lines — `/app`, `/api`, `/admin`, `/parent`, `/school`, `/counsellor`, `/join`, `/onboarding`, `/sign-in`, `/sign-up`, `/account` — then `Host` and `Sitemap` at the configured origin · 2026-10-19 (the three portal paths are new: a page behind an invitation link and a portal's roster must not be walked by a crawler, whatever its `noindex` tag says) |
| `curl /sitemap.xml` | **70 `<loc>` entries** — 11 public pages, 55 career profiles fetched live from `GET /api/careers`, 4 guides with `lastmod` from their frontmatter. With the backend unreachable the same route emits only the public pages instead of failing · 2026-10-18 |
| `/opengraph-image` in a browser, and looked at as a picture | `200 image/png`, 116 KB, 1200×630. The first render **overflowed** — the description pushed the footer off the bottom edge and its two lines collided into one run of text — so the type was scaled down and the footer given a gap; the second render fits inside the frame with both lines apart · 2026-10-18 |
| Metadata in the served HTML | `/` carries `robots: index, follow`, a canonical at `NEXT_PUBLIC_SITE_URL`, the og title/description/url/locale/type plus the twitter large-image card and the generated image's dimensions and alt text, and `Organization` + `WebSite` (with its `SearchAction`) JSON-LD. `/careers/actuary` adds `EducationalOccupationalProgram` + `BreadcrumbList`. `/app` serves `noindex, follow` · 2026-10-18 |
| Third-party requests, no analytics configured | real browser on `/`: **28 requests, every one to `localhost:3000` or `localhost:8000`** — no Google, no Clarity, no other host at all, which is what a deployment with both ids empty is supposed to do · 2026-10-18 |
| `scripts/layout-shot.mjs` — `/`, `/careers`, `/careers/actuary`, `/blog`, `/blog/riasec-test-explained`, `/pricing`, `/privacy` at 375 and 1440 px | no horizontal overflow, no console errors, no failed requests at either width · 2026-10-18 |
| `scripts/hi-coverage.mjs` — the consent copy | **1 151 keys**. The banner, the preferences panel and the privacy page's cookie/receiver sentences were rewritten for analytics and carry their Hindi in the same edit; the 299 strings still without Hindi are the pricing round's billing, checkout and plan-card screens plus the four English-only public pages below · 2026-10-18 |
| `tsc --noEmit`, `eslint src`, `npm run build` — with the portal screens and the portal legal sections in place | typecheck clean; **0 errors, 1 warning** (the pre-existing one in `scripts/layout-shot.mjs`, not a screen); build green at **54 app routes**, with `/school/dashboard` and `/counsellor/dashboard` as `◐` and `/join` as `ƒ` · 2026-10-19 |
| The two portals and `/join`, in a real browser, as **three different accounts** | The practice was opened by an adult account (`127.0.0.1:3000`), and two student sessions on other origins were used so that staff-view and member-view could be seen at once. What was walked, in order: one invite mailed to nobody and the honest sentence that says so (`Email is not enabled on this deployment, so nothing was sent and nothing is on its way`); a pasted class list of three lines where the middle one was not an address — the button read **Send 2 invitations**, the seats went 23 → 21, both waiting rows printed their address, their expiry and the label typed for them, and one of them was then cancelled through its confirmation dialog, which gave the seat back (22) and left the row reading **Removed** with no address line and no button on it; branding saved (after `PUT` was added to `ALLOWED_METHODS`, see below) and read back from the public branding route; `/join` painting the portal's own name and note, and its no-token branch refusing invent; the real UI join, after which the student's MemberView showed the switch, the notes list and Leave; `share_results` flipped false → true → false with the two toasts; the "Your portals" sidebar group carrying the live membership; and a session note written against "A member with no label · 10/19/2026", saved **Private**, pressed to **Share** ("The family has been able to read this since 10/19/2026"), and then found **on the student's own screen** under "Notes your counsellor sent you" — the one direction the backend suite can prove but nobody can prove is legible. Role gating was checked by trying it: a student opening `/school/dashboard?portal=<counsellor slug>` is told "This account has not joined that portal. Nobody becomes a member of a school from a URL." instead of being shown a neighbouring portal · 2026-10-19. **Four defects this pass found that 227 tenancy checks could not**, all of them rendering claims: internal row ids printed as human labels (`Client #2`, `Counsellor #4`) — now a joined-date fallback with no id in it; "The school can see these numbers were dropped" on a *counsellor's* screen — now "This portal can see"; the tier list's dead ternary, which has been replaced by the one true sentence about there being no buy button here; and `/join` claiming "The invitation belongs to the address it was written to", which the server does not check — it now says the link is the invitation and tells the student to keep it on their own device. **What this pass could not do**: `click` and `take_screenshot` are unavailable in this environment (`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`), so every interaction above was driven through `evaluate_script` against the live DOM and read back as text — meaning the portal screens have had **no visual or 375 px layout check**, and `scripts/layout-shot.mjs` does not cover them. Nor was any invitation actually mailed, or any portal subdomain resolved |
| The four public pages in हिन्दी — server-rendered, then checked with `curl` against the **production build inside the container** | `/careers`, `/careers/[slug]`, `/blog` and `/blog/[slug]` are async server components carrying `export const instant = false`, so the interface choice that lives in `localStorage` could never reach them: switching to Hindi in Settings left these four English while every other public page translated. The choice is now resolved **per request** — `?lang=hi`, then the `careerguide.ui-lang` cookie, then English — and a value outside the closed set `en` / `hi` falls back to English, so `?lang=<script>` cannot put anything into the page. The toggle is two real `<a href>` links, not a `<select>` driven by a script, and it carries the choice through the search form (a hidden `lang` input), the category chips and every internal link — which is what keeps the pages honest about the claim in their own header: readable with no sign-in and no JavaScript. The assertions on the rebuilt `web` image: English unchanged; `?lang=hi` and cookie-only Hindi both give Hindi nav, headings, buttons, badges, result counts and empty states on all four pages; `/careers/not-a-real-career?lang=hi` returns the Hindi not-found card; `/careers/nursing?lang=hi` keeps that career's own prose in English and **says so on the page** — as do the guide articles, the metadata and JSON-LD, the category names and the search placeholder, none of which this server holds a second copy of. The study-abroad pages show no toggle at all, deliberately: they were not in scope, and a Hindi button over an untranslated page is the worse outcome. `scripts/hi-coverage.mjs` now reports **0** untranslated strings across these four files and their shared shell — dictionary at **1 228 keys** — and the **612** it still lists are elsewhere: `/pricing`, `/app/billing`, the study-abroad lead form, `toast.tsx`, the older `/app/*` screens. **Two container bugs came out of this same check, and both were real.** The server-side fetch used the *browser-facing* `NEXT_PUBLIC_BACKEND_URL`, so from inside the web container it knocked on its own `localhost:8000`: `/careers` printed "The catalogue service could not be reached" in a stack where the browser half of the app worked perfectly — the server now reads `BACKEND_INTERNAL_URL` (`api.ts`, `site.ts`, `web.environment` in compose, documented in §1). That is also why `sitemap.xml` had been publishing **zero** career URLs from the container; the same route now emits all 55. Looking at the rendered page also found the index printing raw snake_case theme keys (`helping_others`) where a family would read a label — a pre-existing bug in **both** languages, now routed through `THEME_LABELS`, and re-checked to be 0 in each. What this pass did *not* render at first: the "catalogue unavailable" branch, because the API answered every one of these requests — so `docker compose stop api` was run against the live container and `/careers?lang=hi` re-fetched, and the Hindi card came back with its technical explanation, its "no cached or invented list has been placed here" sentence, a Retry link and a link to talk to the guide instead, in Devanagari (`api` was then restarted and re-checked healthy). `npx tsc --noEmit` and `npx eslint src` both exit 0 on this tree · 2026-10-20 |
| `scripts/layout-shot.mjs` — `/careers?lang=hi`, `/careers/nursing?lang=hi`, `/blog?lang=hi` at 1440 and 390 px, Hindi set through the cookie | **4 shots, no horizontal overflow, no console errors, no failed requests** · 2026-10-20. Two were also looked at as pictures, because a Hindi page breaks in ways a text check cannot see: at 1440 the Devanagari conjuncts render correctly in the nav, the section headings and the career titles, and the notice under them reads as a sentence; at 390 the header keeps its English\|हिन्दी pill inside the window and "खोजना शुरू करें" does not spill. That 390 crop shows the Hindi cookie banner covering the fold, which is the modal doing what a modal does |
| `scripts/hi-duplicates.mjs` — the dictionary checked against itself | New tool, and the reason it exists is the merge order in `src/lib/hi/index.ts`: the **last file wins**, so two files disagreeing about `"Exams"` is not a lint nuisance, it is a silent label change on somebody else's screen. It reports a key carrying two different values, names the file whose value actually renders, and lists harmless repeats separately. **3 conflicts, all pre-existing** — `"Exams"`, `"Next"`, `"Browse all careers"` — none in this round's files, none of them moved by it; two keys that *would* have changed the pricing screen's wording were deleted from `public-pages.ts` for exactly that reason, and this script is what catches the next one |
| Study abroad on the three legal pages, in a real browser against a **production build** (`next start`, port 3100) | `/privacy` gained "Study-abroad enquiries", `/terms` "The study-abroad directory and its enquiry form", `/disclaimer` "The study-abroad directory" plus a new line in its list of things nobody guarantees — **a visa, an entry permission, or a right to study in any country** — and each page's `Last updated` moved to 20 October 2026. The claims in them were read off the code first: `StudyLead` has no `user_id` by design, the log line carries the row id and never the address, `create_lead` refuses before it writes anything, `lead_limit` is the one bucket genuinely keyed on the network address, `PATCH /admin/universities/{slug}` refuses `verified: true` without a `source_url` and refuses to clear a source under a verified row, every seeded university is `verified=False`/`sponsored=False` with its fee fields NULL, and `services/recommender.py` imports no study-abroad model at all — so no listing can reach a child's career advice. **Measured, not assumed**: `scripts/hi-prose-check.mjs` reports **0** prose literals missing from the Hindi dictionary, `scripts/hi-coverage.mjs` **1 255 keys** with these three files contributing no gap, and in the browser with `careerguide.ui-lang=hi` each new section was located by its own `id` and read back — **1 035 / 1 676 / 2 678 Devanagari characters** in the disclaimer, terms and privacy sections, **zero** runs of six or more Latin words left in any of them, `<html lang="hi-IN">` on all three. The page-level totals on the same pass (6 687 / 9 473 / 19 620 Devanagari characters) are the whole documents in Hindi. `scripts/layout-shot.mjs` then swept all three pages at 1440 and 390 px: **6 shots, no horizontal overflow, no console errors**; the two failed requests on each are the session prefetch to `:8000`, which that port's origin is not in `CORS_ORIGINS` for — the guard working, as recorded on 2026-10-18. What this did **not** test: an enquiry sent for real (no mail key is set, so the acknowledgement would report `delivered: false`), an operator action taken on the study-abroad screen since it was written, and whether the Hindi reads well to a fluent speaker — the checks prove a string appeared, not that it was phrased the way a Hindi parent would write it. The study-abroad **pages themselves are still English-only**: `?lang=hi` was written for `/careers` and `/blog`, and `/study-abroad*` was left out of that round, so a Hindi family reading about a foreign university gets English there while the legal text about it is in Hindi · 2026-10-20 |
| The legal identity, filled from one file — `curl` on the six legal pages against the running dev server, then `src/lib/legal-entity.ts` imported under five different environments | **0 occurrences of `[COMPANY_NAME]`, `[ADDRESS]`, `[CITY]`, `[EMAIL]` or `[PLACEHOLDER]` across `/privacy`, `/terms`, `/refund`, `/disclaimer`, `/contact` and `/legal`**, and the loud "Not filled yet" badge is gone from every one of them (0). The four fields now come from one module instead of four pages: CareerGuide, grievance@careerguide.com, 123 Tech Park New Delhi India, New Delhi — printed as **sample** values, with one neutral `Sample values` badge on the two pages that show an identity card (`/privacy`, `/contact`) and one sentence naming the five `NEXT_PUBLIC_LEGAL_*` variables that replace them. The rule that sentence hangs on was then tested rather than assumed, by importing the module five times: nothing set → `IS_SAMPLE=true`; all five set → `false`, the officer row appears and the inbox is the operator's; `NEXT_PUBLIC_LEGAL_ADDRESS` left at the bracket token → still `true`, and the sample prints instead of a literal `[ADDRESS]` (the launch mistake that guard exists for); the officer name left bracketed → the row is dropped, not printed as a placeholder; a phone set → a fifth row appears. **A grievance officer's name and a phone number are never sampled** — `OFFICER` and `PHONE` stay empty until a human types them, because a name in a child's privacy policy belongs to somebody, and "call us" is a promise somebody has to staff. The deviation is deliberate and worth stating: the brief asked for these values as fact, and they ship as the values *plus a label*, because printing a registered company, a monitored grievance inbox and a 30-day answer window into a children's policy is inventing three facts nobody here has established · 2026-10-20 |
| `Modal` keyboard focus trap — real browser, the storage-preferences dialog on `/privacy`, `Tab` and `Shift+Tab` dispatched at the focused element with `defaultPrevented` and `document.activeElement` read back | The dialog's own ring is 8 stops (backdrop, close, three switches, the policy link, Cancel, Save) and every boundary holds: `Shift+Tab` on the first stop was **prevented** and landed on the last; `Tab` on the last was **prevented** and landed on the first; `Tab` while focus sat on the dialog panel itself was **prevented** and moved to the first stop; and — the case a `first`/`last`-only trap misses — with focus parked on a page link *outside* the dialog, `Tab` and `Shift+Tab` were both **prevented** and pulled back into the ring, at the first and last stop respectively. Opening focuses the panel rather than its first control, so a screen reader says the dialog's name before it says a button's; `Escape` closed it and `body`'s `overflow` came back to empty. The middle of the ring is deliberately untouched: the handler only answers at the edges, which is what leaves the browser's own traversal alone. **One harness limitation, stated because it bounds the claim**: this browser does not move focus for a synthetic `Tab` keydown (nor for CDP `press_key`), so what was proved is that the trap refuses to let the press out and places focus where the ring says it belongs — not that a physical key was pressed. The dialog was also open in हिन्दी the whole time, which is the row below's evidence for `Modal`, `Checkbox` and the consent strings |
| `Tabs` — roving keyboard focus and a labelled panel | `ArrowRight` / `ArrowLeft` walk the tablist with wrap-around, `Home` / `End` jump to the ends, each one `preventDefault()`ed so a horizontal tablist does not scroll the page sideways under the keys meant for it, and the caret moves **with** the selection — a tablist that swaps the panel but leaves focus where it was shows a keyboard user a list they have already left, and their next `Tab` lands somewhere they did not choose. One `Tab` press per group, not one per tab: only the selected tab carries `tabIndex=0`, the rest are `-1`, and the panel is its own stop. `tabpanelProps(base, active)` builds the `id` / `role="tabpanel"` / `aria-labelledby` triple from the same base the tabs are generated from, so a caller cannot mis-name it; the two screens that use it are `/app/journey` — which spreads the props only when there is more than one tab, so a single-tab list never announces a sequence that does not exist — and the portal screen in `portal-screens.tsx`. **How far this was proved**: through a temporary harness page that mounted `Tabs` beside a panel and dispatched all four keys against the live DOM; it passed and the page was then deleted. The two shipping consumers are signed-in screens, and `http://localhost:3100` is not in the backend's `CORS_ORIGINS` (a `curl -D` with that `Origin` returns no `access-control-allow-origin`), so neither could be walked for real this round — the arrow keys are verified code plus that harness, not a screenshot · 2026-10-20 |
| `/app/reports/[id]` — a file fetch that fails | There is no longer a state that only spins: the effect is keyed on `[row, attempt]`, a failure renders `ErrorState` titled "The report file did not arrive" with the server's own error underneath and a **Fetch it again** button that increments `attempt` and re-runs the same request, and the line below it says the file was not deleted and still sits on the server. **The Delete button lost its `disabled={!file.url}`** — that was the actual defect: a preview that failed to load locked out the one action that would still have worked. Verified by reading the file after the change, with `tsc` and `eslint` clean. **Not exercised in a browser**: that screen needs a session and this dev origin is refused by CORS, so nobody has watched a real network failure become the retry card yet. Adding `http://localhost:3100` to `CORS_ORIGINS` in `backend/.env` would make the whole `/app` set walkable; it was not touched here because that file is a security allowlist, not a convenience · 2026-10-20 |
| Hindi for the five screen groups the brief named — `/onboarding`, `/app/call`, `/app/chat`, `/parent`, `/app/admin/*` — `npx tsc --noEmit`, `npx eslint src`, `scripts/hi-coverage.mjs`, `scripts/hi-duplicates.mjs`, `scripts/hi-prose-check.mjs`, then a real browser | Dictionary at **1 978 keys** (up from 1 255); `tsc` and `eslint src` both exit **0**. `hi-coverage` leaves **1** untranslated string in those files — the `https://…/fees-and-funding` example URL in the university editor, Latin on purpose — and `hi-prose-check` reports **0** prose literals missing across the fifteen files this round touched, primitives included. Three new dictionaries (`hi/parent.ts`, `hi/admin.ts`, `hi/admin-content.ts`) merged in `hi/index.ts`; `hi-duplicates` still shows exactly the **3 pre-existing conflicts** (`Exams`, `Next`, `Browse all careers`) and no new one. The largest fix is not a dictionary entry: the primitives now translate what callers hand them — `Field` / `Input` / `Textarea` / `Select` (label, hint, error, placeholder, every option), `Checkbox` / `Toggle`, `Modal`'s title and description, the toast messages, and `relativeTime()` in `lib/utils.ts`, which is why "1 day ago" under a saved report reads "1 दिन पहले" without every caller remembering to wrap it. `route-guard.tsx` had never been translated at all, so *every* `/app/*` and `/parent` screen opened in English for a Hindi student before it showed anything else; its three gate strings are Hindi now. In the browser with `careerguide.ui-lang=hi`: **`/onboarding`** in Devanagari including the consent checkbox and the two role cards; **`/parent`** and its gate — "सर्वर जवाब नहीं दे रहा", the explanation under it, "फिर कोशिश करें"; and the storage-preferences dialog, whose whole focus ring reads डायलॉग बंद करें / रद्द करें / चुनाव सहेजें. **Verified statically only**: `/app/chat`, `/app/call` and the six `/app/admin/*` screens — the same four checks pass on them, but the browser could not exercise them, because each asks the backend for its data and this dev origin is not in `CORS_ORIGINS`. Repo-wide **380** candidate strings are still English-only, all of them in files outside the five named groups (`/app/billing`, `/app/settings`, `/app/reports`, `/app/interests`, `/app/journey`, `components/portal/*`, `components/pricing/*`, the study-abroad lead form, six section headings on `/refund` and one line on `/terms`) — the same known gap, smaller, not a new one · 2026-10-20 |
| A Hindi screen that stayed English, and what actually caused it | A gate rendered English in a browser holding the right code, and the tell was that React's own view of the tree said `Checking your account…` while the DOM said something else — which is not a missing translation. `navigator.serviceWorker.getRegistrations()` named it: the PWA worker in `public/sw.js` had cached the pre-edit chunks under `careerguide-v2-assets` and `careerguide-v2-static` and was serving those. Unregistering it and deleting both caches made the same URL Hindi on the next load. The speculative store change that theory had already produced was then **reverted** — `lib/i18n.ts` is untouched, the `mounted`-gated store was never the bug — and `tsc`, `eslint` and `hi-duplicates` were re-run against the original file. **For anyone testing this round**: a hard refresh is not always enough. DevTools → Application → Service workers → Unregister, delete those two caches, reload; the worker re-registers itself with current code on that load |

Walked in a real browser starting from a clean slate — no token, no login, only a device id:
the one question → consent gate → dashboard, a **real Groq** Hinglish reply that learned a class and
showed the badge, chat send → reply → **real Gemini** audio (a WAV decoded from the data URL), then
the entry path itself: reloading the page with the token removed resumed the same student, a second
profile with a different id was told it was new and saw none of the first one's data, and
Settings → This device → Start over left the old id still recognised server-side while the browser
came back as a fresh student. No console errors on those routes.

The rest of the screens — call states, career search and save, interests, plans, reports, resources,
scholarships, institutes, parent share-code linking — are exercised end to end by `smoke_test.py`
against the real database and were re-screenshotted with a live session at every width below.

Still needs your own testing:

* **Analytics with a real project attached** — everything measured above was measured with both ids
  empty, which is the state this repo ships in and the state where nothing can leak. Set
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `NEXT_PUBLIC_CLARITY_PROJECT_ID` on a deployment and then, with
  the Network panel open: confirm nothing fires before the banner is answered, accept analytics on a
  public page and watch the two vendors appear, walk to `/app` and confirm nothing new fires there,
  then switch the answer off in *Manage preferences* and watch `_ga` / `_clck` disappear. The
  `googletagmanager.com` / `*.google-analytics.com` / `*.clarity.ms` hosts are in the policy because
  Google's and Microsoft's documentation names them, not because a hit was watched going through this
  CSP — the same distinction as the Clerk and Razorpay rows above.
* **Search Console** — `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is a placeholder that emits no tag while
  empty, and it cannot be filled honestly for a domain this project does not own. Fill it on the day a
  real domain exists, then verify that the tag and the `sitemap.xml` URL are what Google reads.
* **The legal identity, filled and then read by a person** — `src/lib/legal-entity.ts` ships sample
  values so the four legal pages read as finished documents, and each card says in one sentence that
  they are samples. Replacing them is a build-time edit (the `NEXT_PUBLIC_LEGAL_*` block in
  `frontend/.env.example`), and the note is written to disappear on its own once all five are set —
  which means the note itself has to be re-read once it has gone, because from that moment the site is
  asserting a company, an address and an inbox that somebody must actually monitor. Two fields are
  deliberately never sampled: a grievance officer's name and a phone number. Nobody should launch with
  either filled by an invention, and a lawyer should read `/privacy`, `/terms` and `/refund` before a
  real child's data arrives — no automated check here can tell you whether the wording is defensible.
* **The screens this round could only be checked statically** — `/app/chat`, `/app/call` and the six
  `/app/admin/*` screens pass type-check, lint, coverage and prose, but their Hindi was never
  *rendered*: each asks the backend for its data and `http://localhost:3100` is not in
  `CORS_ORIGINS`, so they stop at the gate. Add that origin to `backend/.env` (a deliberate edit to a
  security allowlist, not a convenience) or rebuild the compose `web` image and walk them on `:3000`,
  then look at the two things a coverage script cannot see: a Devanagari label inside a fixed-width
  operator table cell, and a long admin sentence at 375 px. Same for `/app/reports/[id]`'s new retry
  card — nobody has watched a real failed fetch become it — and for `Tabs`' arrow keys on
  `/app/journey` and the portal screen, which were proved through a temporary harness page rather
  than on either shipping screen.
* **The four public pages, read by a Hindi speaker** — `/careers`, `/careers/[slug]`, `/blog` and
  `/blog/[slug]` now translate their own frame on the server (§5), so the old gap — a Hindi app with
  four English pages — is closed. What is still English is the *content*, and that is a decision rather
  than a leftover: the 55 career descriptions and the guide articles exist in one language in this repo,
  and inventing a Hindi second copy would mean paraphrasing figures nobody has verified against a source.
  A Hindi visitor gets a Hindi frame, the English body, and a sentence on the page saying so. What no
  script can settle is taste: have someone who reads Hindi for a living check these labels — the open
  `"Exams"` conflict (एग्ज़ाम versus परीक्षा) is exactly the kind of choice a native reader should make,
  not one a merge order should make by default.
* **The Hindi wording itself, as prose** — the unavailable card on `/careers?lang=hi` has now been
  rendered for real with `api` stopped, and one line of it reads clumsy: `कोई काम का जवाब नहीं मिला` for
  "no usable reply", which a fluent speaker would phrase differently. Nothing in this round's Hindi has
  been read by a person who thinks in the language — every check here proved that a string *appeared*,
  not that it reads well to the family it was written for.
* **Clicking a real throttle** — `security_test.py` proves the `429` and its `Retry-After`, but nobody
  has sat in the chat screen and pressed send twenty-one times to see how that sentence looks in the UI.
  Same for a questionnaire cut off mid-answer. Worth doing once, on purpose, at a phone width.
* **The Content-Security-Policy with Clerk switched on** — the Clerk hosts are in the policy because
  Clerk's documentation names them, not because a sign-in was watched through this policy. Attach a real
  Clerk project and complete one sign-in with the console open before assuming the widget is not blocked.
  (Email sign-in is unverified in this build for the older reasons too — see §4.)
* **A payment that actually captures** — `payments_test.py` replaces Razorpay with a stub that records
  what this server asked for, which is the only honest way to test signatures, replay and the ledger
  without a key. It cannot prove that a real order opens. Put a **test-mode** key pair in `backend/.env`,
  open `/pricing` with the console visible, and complete one ₹10 charge end to end: the hosted sheet
  rendering under this `frame-src`, the callback verifying, the plan changing on `/app/billing`, and a
  second page load still showing it. Nothing in this build has done any of that yet.
* **Razorpay's frame through this CSP** — `checkout.razorpay.com` is in `script-src`, `frame-src` and
  `connect-src` because the provider's documentation names those hosts, not because a checkout was
  watched with a `securitypolicyviolation` listener attached. `script-src` carries `'unsafe-inline'`
  (a prerendered page cannot thread a per-request nonce), so this is the one place where the policy is
  looser than the ideal. If a sheet ever opens blank, look for a blocked frame in the console before
  you look for a bug in the code.
* **The webhook, from Razorpay's side** — the signature rules are tested by constructing deliveries.
  Nobody has created the endpoint in the dashboard, subscribed it to `payment.captured` and
  `payment.failed`, and watched a real one arrive. Until that happens the webhook is code plus a stub.
* **Refunding** — there is no refund action inside this app, by design, so a refund is a person in the
  Razorpay dashboard pressing a button. That path has never been walked, and the times published on
  `/refund` (answer in five working days, money in ten) have never been measured against anything.
* **`/pricing` and `/app/billing` in हिन्दी** — the layout sweep ran both pages in Hindi at 375 and
  1440 px and found no overflow and no console errors, but that is not the same as the pages being
  translated: 103 of their strings are new English sources with no entry in `src/lib/hi/*.ts`, so a
  Hindi family is shown an English price list today. Nothing about the money copy has been read by a
  Hindi speaker either, which matters more here than anywhere else in the app — this is the screen where
  a sentence that reads as a hedge in English can read as a promise in translation.
* **Microphone speech-to-text** — the Web Speech path and its failure states are wired, but a
  blocked-microphone browser cannot prove capture. Needs a visible window where you allow the mic;
  Chrome/Edge yes, Firefox/Safari inconsistently. The `Permissions-Policy` now grants the microphone to
  this origin only, which is what the browser will honour. This round changed one thing in that header:
  `payment` is now `(self "https://checkout.razorpay.com")` instead of `()`, so exactly one named third
  party may open a payment sheet. Camera, geolocation, USB, MIDI and advertising-interest stay closed
  to every frame including Razorpay's — a checkout can ask for a card, it cannot ask for a microphone.
* **Hearing the audio** and Hindi voice quality — no speakers here.
* **Layouts** — `scripts/layout-shot.mjs` screenshotted 8 routes (dashboard, streams, exams,
  careers, settings, privacy, terms, contact) at 320, 375, 768 and 1280 px, in both English and
  हिन्दी: 8 × 4 × 2 = 64 shots, each `/app` screen backed by a live student token. **No horizontal
  overflow, no console errors, no failed requests** · 2026-10-16. The tool also asks each page
  whether it is wider than its own window.
* **What that sweep cannot see** — a keyboard-only walkthrough of the ☰ drawer, anything needing a
  real microphone, and `/parent`, which is not in this round's 8 routes (its share-code linking is
  covered end to end by `smoke_test.py` instead).
* **Paper, beyond `/terms`** — the print stylesheet has now actually been looked at (above) for
  `/terms`, and every legal page shares that one frame, so the same rules apply. What has not been
  looked at is where the long pages break: `/privacy` runs to 16 sections, and only a real printer
  will show whether a heading is orphaned at the bottom of a sheet. Print it yourself — the button is
  in the header at ≥ 640 px — before handing a copy to anyone.
* **Paper, for a printed result** — "Print / Save PDF" on a result page is the browser's own print
  dialog behind the same `print:hidden` / `print:block` frame `/terms` uses. Emulated print has now
  been looked at, at 816×1056 and 1052×724, and it found the app shell printing its own chrome: the
  mobile header, the five-slot bottom bar and — at the wider size — the navy sidebar and the 264 px
  column it reserves. All four are `print:hidden` now and the shell collapses to one column in print
  (`app-shell.tsx`), so a printed result carries the badges, the date line, the chart, the five areas
  with their counts, the careers and the caveats, and nothing else. What a real printer still has to
  answer is where the long page breaks: only a sheet from an actual machine will show whether an area
  row is orphaned at the bottom. Print one before handing a copy to anyone.
* **The server-rendered PDF report** — `/api/reports/generate` now draws a real multi-page document
  (ReportLab, Devanagari shaped through HarfBuzz) and `/app/reports/[id]` previews it, downloads it
  and deletes it. What is *not* yet answered by a machine: the pages were measured and read back as
  text, and rendered to PNGs to be looked at, but nobody has opened the downloaded file on a phone or
  printed it from a real printer, so how it paginates on thermal/A4 drivers is unknown. The branding
  is a text wordmark plus the app's own colours — there is no logo image embedded, because the repo
  has no approved raster logo to embed. English and हिन्दी (and Hinglish, which prints Hindi as it
  does on screen) are the two documents; any other interface language is given the English one, and
  the badge on the preview page names the language the file was actually printed in rather than
  leaving a family to guess. One property of forced shaping is worth stating plainly because it was
  measured rather than assumed: the Hindi *pixels* are right, but the Hindi *text layer* is not — a
  conjunct is stored as one private-use glyph and a vowel sign sits where it is drawn rather than
  where it was typed, so `Ctrl-F` for "रिपोर्ट" in a Hindi PDF finds nothing, while every Latin word in
  the same file (and the whole English document) searches and copy-pastes normally.
* **The install prompt** — the manifest, the service worker and the theme-color / apple-touch-icon
  tags were checked in a real browser against the production build, but nobody has clicked Chrome's
  "Install app" and used the installed window. And there is no offline story to test: the worker is
  network-only on purpose, so an installed app with no connection shows the app's own error states.
* **The deployed site** — live it is now a real Groq reply and a real Gemini voice, verified through
  the API on 2026-10-16, but nobody has *listened* to that audio or walked the guest flow in a browser
  on the production URL. Do that before showing it to anyone.
* **This is not full-duplex streaming audio** — one voice speaks at a time and the call screen says
  so. The server's speech service needs internet; none of these voices is an offline guarantee.
* **The email sign-in with Clerk actually switched on** — the screens, the endpoints, the two columns
  and the webhook all exist, and `clerk_auth_test.py` passes its 105 checks against a stand-in that
  answers the way Clerk's documentation says the real API does. But no Clerk project has ever been
  attached to this build. Until somebody sets the keys and walks steps 1–6 of §4 in a browser, these
  are unverified: Clerk's live widget, a genuine `POST /v1/tokens/verify` round trip, a real
  Svix-signed `user.deleted` delivery, the two-browser "come back by email" story, and the size of
  the bundle `ClerkProvider` adds on a deployment that never uses it.

---

**2026-10-20, after the session moved out of `localStorage` and into an `httpOnly` cookie (§6): the
whole battery ran again — 17 suites, 1 826 checks, 0 failed** — plus `schema_fit_check.py`, which
re-checked 182 seeded strings and found 0 columns too short. Seven of those suites were edited rather
than merely re-run, and the reason is worth recording because it is the new thing cookie authentication
does to a test: `TestClient` is a browser, so a client that was handed a session in an earlier check
*keeps* it, and every "an anonymous caller is refused" assertion had to empty its jar
(`client.cookies.clear()`) or it was quietly proving that a signed-in request succeeds. `admin_test.py`,
`assessment_test.py`, `clerk_auth_test.py`, `payments_test.py`, `report_pdf_test.py`, `smoke_test.py` and
`study_abroad_test.py` each needed that one line; their check counts did not move. Three suites grew:
`guest_session_test.py` now asserts the cookie itself (that it is `HttpOnly`, host-only, `Path=/`, that
its value is the session, that a cookie alone opens the account, that a bad header does **not** fall
back to the jar, that logout expires it, and that `X-Forwarded-Proto: https` yields `Secure` +
`SameSite=None` while plain http yields `Lax` with no `Secure`), `security_test.py` gained the CSRF pair
(a `text/plain` body is refused where the same cookie with JSON is accepted), and `login_test.py`
gained the device binding a come-back code login now makes, so a code typed once turns that device into
the account instead of asking for the code again on every reload. `npx tsc --noEmit` and `npx eslint src`
both exit 0 on this tree. `npm run build` was **not** re-run in this pass: a dev server holds `:3000` on
this machine and a production build overwrites the `.next` it is serving, so that one is unverified here
rather than reported as passing.

**2026-10-20, later: the battery ran again — 17 suites, 1 838 checks, 0 failed** — because `0010` had
crashed on a real database, and the crash was not in the migration's own logic. `app/schema_sync.py` runs
on *every* boot and adds any nullable model column an existing table lacks, so a deployment that starts
this code before running `alembic upgrade head` arrives with `users.device_hash` (empty) sitting beside a
plaintext `users.device_id`. `RENAME COLUMN device_id TO device_hash` into a name the table already holds
is a `DuplicateColumnError` inside SQLite's batch rebuild — meaning the container's own entrypoint dies:
the app boots, schema sync mutates the table, and the migration that follows can no longer find a table it
can fix. `0010` now merges instead of renaming (hash the plaintext across, drop the column that held it,
leave the index on the surviving column), `scripts/migration_test.py` gained a tenth section that builds
that state deliberately (12 checks, 180 → 192), and both engines were driven for real: the local `.db`
that was crashing now reaches the head with 9 digests and `token_hash` in place, and a throwaway
PostgreSQL 17 container reproduced the same state through the actual `add_missing_columns()` before
migrating clean. Nothing in the `careerguide` compose stack was touched, and the scratch container is
removed.

## 6. Rules the code enforces (not only the UI)

* A browser is told what it may load. `frontend/src/middleware.ts` answers **every** route that can
  return a document with a `Content-Security-Policy`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a
  `Permissions-Policy` that closes the camera, geolocation, USB, MIDI and advertising-interest cohorts
  outright, grants `payment` to `https://checkout.razorpay.com` and to nothing else, and leaves the
  microphone open on this origin only — because the screen that dictates with the Web Speech API is this
  one, and nothing embedded in it. A checkout may ask for a card; it may not ask for a microphone. The policy carries
  `'unsafe-inline'` for scripts and **no nonce**: a nonce needs every request rendered dynamically, which
  `cacheComponents` and partial prefetching rule out. That is a real weakening, written here rather than
  in a comment nobody reads. What it can no longer buy an injected script is the credential: the session
  is an `httpOnly` cookie, so it cannot be read out of this browser and spent later somewhere else, and
  `form-action 'self'` still keeps a pasted script from posting a form to a foreign address. What it does
  still buy is the right to make this origin's own requests with that cookie attached, which is what a
  browser does for any script on the page — `httpOnly` protects the *secret*, not the *session*. The
  weight on that side is carried by rules that do not depend on this header: every write demands a JSON
  body, so a form-shaped cross-site request cannot reach one; CORS answers only the origins named in
  `CORS_ORIGINS`; which account a request speaks for comes from the session, never from an id in the
  body; and the throttles below cap what one tab can ask for. Dropping `'unsafe-inline'` needs a nonce,
  and a nonce needs every page rendered per request — a change to how this site is deployed, not a
  header edit, which is why it is written down instead of done.

* The session lives where page script cannot reach it. Every response that starts one writes a cookie as
  well as returning the string (`backend/app/security.py`): `cg_session`, `Path=/`, host-only (no
  `Domain=`), `HttpOnly`, `Max-Age` mirroring the session row, `Secure` decided per request — from
  `X-Forwarded-Proto`, else the URL scheme, with `localhost` and `*.localhost` trusted without it — and
  `SameSite=None` when it is secure, downgraded to `Lax` whenever `Secure` cannot be honoured, because a
  `None`-without-`Secure` cookie is one a modern browser deletes rather than a protection. Every frontend
  fetch sends `credentials: 'include'`. `Authorization: Bearer` still works, and the frontend keeps a
  bearer string as a **memory-only** fallback (`frontend/src/lib/api.ts`) for the browsers that will not
  accept a cookie set by a cross-origin fetch — this deployment's page and API are two hosts under
  `vercel.app`, which is a public suffix, so Safari and strict-protection Firefox are exactly those
  browsers. Nothing about a session is written to `localStorage`, `sessionStorage` or a readable cookie,
  so a reload is answered by the cookie where that works and by the device id where it does not,
  `/api/auth/refresh` extends a session an open page asks about (hourly, and never past the ceiling that
  sign-in was given), and the database holds only `sha256` of the string — a dump of `auth_tokens` is not
  a list of ways into a child's account.
* One browser cannot spend the school's money or everyone's patience. **48 route handlers** carry their
  own slowapi bucket (`backend/app/middleware/rate_limit.py` — count them with
  `grep -h '^@[a-z_]*limit' app/routers/*.py | wc -l`, up from the nine this sentence named when it was
  first written; the newest is `POST /api/ai/mock-interview`, the practice interviewer, at 12 a minute —
  looser than the roadmap's 6 because a five-question sitting is six calls in a row by design, and a sitting
  that pauses costs nothing since it overwrites nothing), and the bucket is the caller's **session**, hashed,
  not their street address: on a shared school IP an address bucket would lock out a whole classroom
  because one student held down the send button. Chat and speech 20 a minute, starting or submitting a
  questionnaire 10, sign-in routes 5, the device lookup 30 (it runs on every page load — five would
  tell a family their own account is unavailable for a minute). The per-answer autosave is deliberately
  the loosest at 40: the longest questionnaire has 30 items, and a 10-a-minute rule would cut a fast
  student off halfway through a sitting and throw away the answers they had given. A `429` returns
  `Retry-After` and a sentence a child can read; no stack trace and no library vocabulary. The counts
  live in this process, so on serverless each instance keeps its own — they are a floor there, not a
  wall, and the defence that still matters on a come-back code is the 210 000-round PBKDF2, not this.
* Only the origins this site is served from may call the API from a browser
  (`backend/app/middleware/cors.py`). A `*` in `CORS_ORIGINS` is dropped with a log line instead of
  obeyed, whitespace and trailing slashes are normalised away, the deployment's own public URL is folded
  in once, and credentials are answered for only because a wildcard was already refused — a credentialed
  `*` is the one combination that turns a visitor's browser into a way to read any family's data.
  `security_test.py` asserts that a listed origin gets `access-control-allow-credentials: true` and that
  a stranger's `Origin` comes back with no `access-control-allow-origin` attached to it at all.
* Every request body says what it will not accept. All **57** input models inherit `StrictIn`
  (`extra="forbid"` — count them with `grep -c 'class .*StrictIn)' app/schemas.py`), so an undocumented key is a `422` rather than a field someone *might* read later;
  every free-text field has a stated length; ids must be `ge=1`; a device id has a character class and a
  length; a plan's `resource_url` must begin `http(s)://` before it can ever become an `<a href>` on a
  student's own page; `?limit=` on the journey feed is bounded 1–200, because a negative `LIMIT` in
  SQLite means *no limit* and a career API that dumps every row of a child's history to a guessed id is
  not a prototype problem. Query parameters and path segments are validated too (`max_length` on the
  language switches, a slug pattern on `/api/careers/{slug}`), and a bearer token must match its own
  shape before the database is opened.
* Access is checked server-side against the session token: a parent cannot read another family's
  data by changing an id in a request. The prototype's device id is only ever a lookup — sending it
  as a bearer token is answered `401`, which `guest_session_test.py` asserts.
* A resume is one document owned by the session that saved it. `resumes.user_id` is the primary key, so
  "one CV per account" is the database's rule rather than one every route has to remember, and both the
  read and the save resolve the row from the id the token proved — a body naming somebody else's account
  writes the caller's own document or nothing. A parent and a portal counsellor are refused the *route*,
  not only the sidebar link, and the parent refusal lands before the suggester is entered, so a screen a
  family cannot open cannot spend the site's provider budget. What leaves this app toward a model from
  here is one string: the job title the student typed. `resume_test.py` makes that a measured claim by
  saving a CV carrying a sentinel school name, a phone number and a project line, then searching every
  request the stand-in provider recorded for all three. Printing is the browser's own dialog, so this
  server builds no PDF, holds no copy of a printed page, and no recruiter is sent anything.
* A practice interview keeps nothing, and that is the rule rather than the absence of one. `POST
  /api/ai/mock-interview` opens no conversation row and writes no table: the questions and answers exist in
  the request and in the tab, and `interview_test.py` proves it by counting every table before and after a
  whole sitting and then scanning every row of every table for the sentences that were typed. A parent is
  refused `403` on the route — the guard runs before the model is called, because a guardian watching a
  child practise turns the practice into an inspection, and that is decided by the server rather than by
  which links the sidebar shows. The five-question limit is the server's count of the answers, not the
  caller's `question_number` and not the model's mood, so neither a hand-edited body nor a model that wants
  to keep talking can lengthen it. An answer that reads like a child asking for help is closed by the app's
  own safety sentence before the provider is contacted, and the sitting ends unscored.
* A plan on a result is part of the result, which is the same rule in a new shape: `roadmap_json` lives on
  the `results` row, so the read and the ✨ rewrite both resolve it through the session before they touch a
  plan, another student's result is the same `404` it always was, a parent is refused before the provider is
  entered, and the plan goes when the account is erased because the row holding it goes. What reaches a model
  from the ✨ button is `roadmap.facts()` and nothing else: each area's name, its score out of 100, its band,
  how many questions that number rests on, and the career this app's own notes pointed at with the skills
  those notes list for it. `roadmap_test.py` makes that measured rather than read — a school name, a phone
  number, a student's name, a project line and one of their answers are planted on that account, and every
  request the stand-in provider recorded is searched for all five. The chat hand-off is the same claim from
  the other side: what is put in front of the guide is the plan already rendered on the student's own page,
  in the language they are reading, and a `plan_of` naming somebody else's result answers `404` instead of
  leaking a peek.
* A portal puts an institution next to a child's app, so its rules are enforced the same way — from the
  database, on every request. `counsellor` and `school_admin` are roles on a **membership row**, never on
  the account, and `require_admin` / `require_member` read that row before any query runs: a student
  invited into a school as its counsellor is refused in words, and a school's own administrator is not the
  platform's administrator and cannot close their portal. An invitation is inert — an address, a digest and
  an expiry that answer nothing to anybody — until `POST /join`, whose only proof is the token, which is why
  the screens tell a student to keep the link on their own device instead of claiming the address is checked.
  `share_results` is off in the column, in the invite as it is created and in the value written at join, and
  only its owner may flip it; a session note is readable by its author alone until the author shares it.
  Every analytics breakdown under five people is dropped *and named* in the response, so a head teacher sees
  the guard fire rather than wondering which class went missing. And no portal response carries an answer, a
  score, a transcript, a report or a conversation — `tenancy_test.py` asserts that over every JSON body it
  fetches, which is what lets a portal screen promise a child that joining does not open their file.
* Running the site is a column, not a claim. `/api/admin/*` hangs off
  `APIRouter(dependencies=[Depends(get_admin_user)])`, so a route cannot be added under that prefix without
  passing the check, and `admin_test.py` proves it from outside for every route in `app.openapi()["paths"]`
  as an anonymous caller, a student, a parent and a school's administrator. `get_admin_user` reads
  `users.is_admin` and nothing else — not a role in a token, not a header, not a body field, and the suite
  asserts against the generated schema that no input model anywhere has one. `NULL` counts as not-an-admin,
  so every account predating the column is refused by it, and a **closed** account is refused even with the
  flag set. The flag is set only by `scripts/admin_grant.py`, which refuses an address that is saved but
  never confirmed, and the screen refuses to put it on an account that cannot sign in — a flag on a closed
  account would be a door that looks open and is not. What an operator may read is a *list, not a schema*:
  `AdminUserRowOut`, `AdminSummaryOut` and `AuditEventOut` hold no device id, come-back hash, token,
  transcript or answer value — the fields are absent from those models, so there is no field to forget to
  hide — and no query in `routers/admin.py` reads `Message.content`. Every change appends exactly one
  `audit_events` row in the same transaction, holding the action, the subject and **which fields were
  touched, never their values**, because those values include a student's name and a family's enquiry and a
  log gets read by more people than those rows were meant for; the table has no column that could hold a
  request body, an address, a user agent or a device string, reads are not logged, and there is no delete or
  clear — the person who would want a line removed from the log is the person holding the keys. Money keeps
  its honesty in the same place: figures are sums of paise, and `test_paise` is never added to the captured
  total, because a payment made with a test key moved nothing.
* An email sign-in authorises nothing by itself. Clerk only ever answers *which* email a browser is
  using; every data route still requires this app's own bearer token. `POST /api/auth/clerk/link`
  is answered `401` before Clerk is contacted at all when that token is missing, `POST /enter`
  mints a token for the single account the email was already attached to, and a Clerk session on its
  own reaches no data. `clerk_auth_test.py` asserts both refusals.
* Consent is recorded per scope and gates voice and history; transcripts can be deleted by the
  student. Raw microphone audio is never stored, nothing records in the background, and no
  monitoring happens without an explicit, visible session.
* The three questionnaires keep their marking on the server: an answer is sent as a code and a value,
  the correct answer never appears in any response, and the scores are computed from the stored
  answers rather than from anything the browser claims. A result row belongs to the account that
  finished it — `GET /api/assessments/result/{id}` for another student's id is answered the same way
  as one that does not exist, so the API cannot be used to probe who has taken a questionnaire.
* The printed report is a *derived* copy and is treated as one: the bytes live in the database in a
  column no JSON response returns, never in a folder beside a child's answers, so there is no second
  copy that the delete path has not been told about. Deleting any questionnaire inside it (or the
  account) invalidates or cascades it away, one row per student per language means three result
  pages cannot store three copies of the same answers, and downloading it requires the same bearer
  token as everything else here — `download_path` is not a public URL and guessing another id returns
  the same body as a report that does not exist.
* One gap is recorded rather than papered over: **a session token is stored in `auth_tokens` exactly as
  it was issued**, so a dump of that table is a list of live sessions, not a list of hashes. Hashing it
  is the right fix and it is deliberately not done here, because it needs a migration *and* every device
  in use signing in again — which on a prototype with real browsers open is a breaking change someone
  should choose, not one that should arrive as a side effect of a hardening pass. The same note is in
  `backend/app/security.py` where the code lives. What *is* done: the token never appears in a log, a
  rate-limit key or an error body (`security_test.py` asserts all three), and it must match its own
  character shape before the database is touched.
* Personal data is minimised: no email, phone, exact location, school address, bank details or
  financial documents. A payment adds nothing personal either — no card number, expiry, CVV or
  cardholder name is ever asked for or stored, because the card sheet is Razorpay's own document served
  by them. What this database keeps about money is an order id, a payment id, an amount in paise, a
  receipt number and which plan it bought. The resume table holds to the same line: the job title aimed
  at and the three lists the student typed, and no column for a name, phone, address, email or photo —
  the name at the top of the printed page is the one the account already holds, which the erasure route
  already clears, and a second copy in a second table would be a copy that gets left behind.
* A career suggestion is never influenced by payment or sponsorship; sponsored entries are badged.
  `payments_test.py` asserts this the only way it can be asserted: the recommendation output is compared
  before and after an account becomes paid, and it has to be identical.
* Careers, resources, scholarships and institutions are **sample data for exploration** — fees,
  deadlines, placements and scheme rules must be checked on official sites. No guaranteed outcomes.
  They are also **free on every plan**: a paid tier buys volume, repeat questionnaires, the printed
  report and a guardian's view, never a better answer.
* **Payments are built and switched off.** The Razorpay integration exists on both sides and is tested
  against a stubbed provider, but with no `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` on this deployment
  `GET /api/payments/plans` returns `payments_enabled: false`, `/pricing` renders its upgrade buttons
  disabled with the reason printed beside them, and an order cannot be created. Nothing has ever been
  charged. On top of that: **no automatic renewal** (a paid period ends and stays ended until someone
  pays again), **no in-app refund action** (a refund is a person in the provider's dashboard), and every
  free-plan cap sits behind `PLAN_LIMITS_ENFORCED`, which defaults to **false** — so today even a Free
  account gets unlimited chats and all three questionnaires, which is a state the pricing page prints
  about itself rather than hiding.
* **Measurement is off until three things are true.** `Analytics.tsx` loads a vendor script only when
  an id is configured, the device has answered consent, **and** the current path is public. The third
  condition is not a courtesy: Microsoft Clarity replays a page's own elements, including text in an
  input box, so `/app`, `/parent`, `/onboarding`, `/sign-in`, `/sign-up` and `/account` are blocked in
  the component regardless of what was consented to — a consent banner cannot un-share a conversation
  that was never meant to be recorded. Withdrawal calls `clarity("stop")` and deletes `_ga`, `_gid`,
  `_ga_<property>`, `_clck`, `_clsk` and the vendors' `localStorage` keys. Those same routes carry
  `robots: NOINDEX` in addition to `robots.txt`'s `Disallow`, because a rule a crawler may ignore is
  not the same thing as a page that refuses to be indexed, and neither is the session check that
  actually protects them.
* Disclosures of danger or abuse get an age-appropriate, safety-focused reply pointing to a trusted
  adult or a local service. That reply is the built-in one **even after a real AI model is
  configured** — the sentence a frightened child reads back is never left to a model, and the
  disclosure is not sent to the provider at all.

These are features, not a legal opinion: **this build has not had qualified legal review**, and
moving a child's conversations to a hosted database changes where that data lives, who can reach it
and how long it survives. Get review before real children use it. Vercel's Hobby plan is
non-commercial, which fits a personal pilot but not a paid service. Supabase free-tier projects also
pause after a week of inactivity.

## 7. Containers, CI and the Postgres cutover

Everything above this section describes the app running as two processes on a laptop and a Vercel
deployment. This section is the other three ways it can be stood up: a compose stack on one host, the
GitHub Actions files that check it, and the script that moves a live SQLite database onto Postgres.

### `docker compose up`

```bash
cp .env.example .env          # then set POSTGRES_PASSWORD — there is no default
docker compose up --build     # add WEB_PORT=3001 if something already holds 3000
docker compose --profile mail up --build     # also start the outbox drain
```

Four services and one guest: `postgres:17-alpine` with a named volume, `redis:7-alpine` started with
`--save '' --appendonly no` because it holds rate-limit counters and nothing worth recovering, the API
(`uvicorn`, one worker), the web app, and `email-worker` behind a `mail` profile so it cannot start by
accident on a machine with no `RESEND_API_KEY`. `POSTGRES_PASSWORD` is written `${POSTGRES_PASSWORD:?}`
— no default, so compose **refuses to come up** rather than bringing a database online with a
well-known password. `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_SITE_URL` are passed to the web image
as **build** arguments, because that is the only way those values reach a browser bundle; an image
built against `localhost:8000` will not talk to an API on another host and no run-time variable fixes
it afterwards.

The API's entrypoint asks the database what state it is in and takes one of three paths. If there is
an `alembic_version` table, migrations own it: `alembic upgrade head`, then `scripts/db_init.py` to
confirm the tables and seed the catalogue if any of them are empty. If there are **no tables at all**,
it is a fresh volume, and the chain builds the whole thing on its own — `alembic upgrade head`, then
the same seed step. If there are tables but no `alembic_version`, the app's own first boot (or a
restore from before the chain) made them, so it runs `scripts/db_init.py` and then `alembic stamp
head`, which records the revision without replaying DDL over tables that exist.

The middle path is new, and it exists because of a difference between the two engines that used to
make the container unbuildable: SQLite quietly accepts a `CREATE TABLE` that references a table that
does not exist yet, while Postgres refuses it. `0001_assessment_tables` points its foreign keys at
`users`, which nothing in the chain used to create, so `alembic upgrade head` against an empty Postgres
died on `relation "users" does not exist` while working fine on a laptop — the entrypoint had to run
`db_init.py` first just to make the migrations applicable. `0000_baseline_schema` is the fix: the chain
now creates all thirty-seven tables, `upgrade head` alone brings an empty database to head, and
`scripts/migration_test.py` proves the result is column-for-column what the models describe.
`RUN_MIGRATIONS=0` still starts the container against a schema somebody else prepared.

The healthchecks say something about first boot rather than about uptime: the API's `start_period` is
**120 s**, because the port does not open until the entrypoint has finished inserting the catalogue —
55 careers, 510 universities and the rest — and a 20-second grace period reads that honest work as a
dead container and tears the stack down around it. Both images probe with a real request (the API hits
`/api/health`, the web container hits `/`) rather than checking that a port is open.

Verified on this machine, 2026-10-19: all four services reach `healthy`; `/api/health` answers
`{"status": "ok", "storage": "ready", "ai_provider": "demo", "demo_mode": true}`; the production web
container serves `/manifest.webmanifest`, `/sw.js` and the four icons with their real content types and
the CSP header intact; and the whole Postgres write path was exercised through the API — guest session
by device id, onboarding, a conversation with replies, a 30-item interest questionnaire answered and
submitted, scored, recommendations returned — including that a newly created account receives an id
above the highest one already in the table, which is the sequence having been restarted correctly.
What this stack does **not** do: no TLS (put a proxy in front), no backup job, no orchestration, and
payments stay off exactly as they are off on Vercel.

### The images

`backend/Dockerfile` is `python:3.12-slim` and not the 3.11 the brief named, deliberately: every one of
the 1 802 checks was executed on 3.12.7 and the pinned wheels (`psycopg[binary]`, `uharfbuzz`,
`reportlab`) are the kind a different interpreter resolves differently. Two stages, no apt packages —
nothing here compiles from source, so a gcc layer would be 300 MB bought for nothing. It runs as an
unprivileged user, because the container holds children's conversations and a stray `open(path, "w")`
should fail rather than succeed quietly; nothing needs a writable directory, since generated speech
returns inside the reply as a data URL. It also strips `\r` from the entrypoint at build time: this
repository is checked out on Windows, and a CRLF shell script is a `/bin/sh` error that looks like a
broken app.

`frontend/Dockerfile` is three stages (`deps` → `builder` → `runner`), because `node_modules` for this
app is hundreds of megabytes and `next start` touches a fraction of it. It copies by name, so
`NEXT_DOCKER_STANDALONE=1` is what asks `next.config.ts` for the self-contained output the last stage
carries — unset on Vercel, which does not run `next start`. Both `.dockerignore` files exist for the
same reason stated twice: the backend one keeps `careerguide.db` and `media/` out of an image layer
where deleting them from the working tree afterwards changes nothing, and the frontend one — added
today — keeps `.env.local` and the previous local build's `.next` out of the context that gets shipped
to the daemon before a single Dockerfile line is read.

### CI

`.github/workflows/frontend.yml`, `backend.yml`, `security.yml` and `.github/dependabot.yml`. Each file
opens with what its steps actually prove, because a workflow nobody can read is a job nobody trusts.

* **frontend** — `npm ci` (exact lock file), `tsc --noEmit`, `npm run lint`, `npm run build`, then an
  assertion that the PWA still describes routes this build serves: the manifest's icons exist under
  `public/`, one carries `purpose: maskable`, `start_url` is a route in the build's own
  `app-path-routes-manifest.json` (rather than a list of file names somebody must remember to update),
  and the admin, portal and public routes are all served.
* **backend** — `pip install` of the pins, `compileall` over `app`, `scripts` and `migrations` (this is
  the whole of the repository's static checking today: there is no ruff or mypy configured anywhere in
  `backend/`, so the job does not pretend to run one), `alembic upgrade head --sql` against a Postgres
  URL with no server behind it — asserting the chain creates all forty tables on its own (thirty-nine the
  application has, plus alembic's own version row), that `users` is created before `assessments` points at
  it (the Issue 11 failure, in the form PostgreSQL enforces) and `exam_groups` before `exams` for the same
  reason, that `users.erased_at` is in the rendered SQL rather than only in the laptop's database, the
  tenancy/audit/outbox/exam names and the
  `VARCHAR(32)` widening — `schema_fit_check.py`, then a loop over `scripts/*_test.py` in `::group::`
  blocks that fails on the first non-zero exit and prints the suite count rather than hardcoding it.
  That step was **executed here on 2026-10-20** against the real rendered chain, and every branch of it
  took the value it now expects: `tables created: 40`, `users` at line 10 with `assessments` at 296,
  `exam_groups` at 741 with `exams` at 751, `ALTER TABLE users ADD COLUMN erased_at` present.
  The suites need no server, no database and no network: each builds its own SQLite file in the temp
  directory and talks to the app through `TestClient`, and a suite that wants a provider key prints
  `[SKIP]` and exits 0 without one, which is why a keyless CI run is a supported mode rather than a
  green lie.
* **security** — weekly, Monday 03:30 UTC, plus manual. Two audits (`pip-audit` on the backend pins,
  `npm audit --package-lock-only` on the frontend) that **report into the run summary and warn** rather
  than fail, and two checks that do fail: nothing private tracked (no live `.env`, no database file,
  every credential line in all three `.env.example` files blank, both `.dockerignore`s and `.gitignore`
  still ignoring env and db files) and no credential-shaped string anywhere in the tree. The audits are
  advisory because of a fact on the table: `npm audit` exits non-zero on this lock file today —
  `braces`, reached through `eslint-config-next`, build tooling rather than code the browser runs, with
  only a breaking version change offered as the fix. A weekly job that has been red for three months
  over a decision nobody has made is a job that gets ignored. The manual run has a `fail_on_findings`
  switch for the day somebody does decide to bump the pins and wants the proof.
* **dependabot** opens pull requests and merges none: patch and minor bumps grouped per ecosystem
  weekly, image and action bumps monthly. Deleting the file is the whole unsubscribe.

**What has not happened.** None of these workflows has run: a workflow only executes once it is pushed
to GitHub, and nothing here has been pushed. Neither deploy job has ever run — they wait on repository
secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, refuse with `::error::` rather than
reporting success without them, and exist for rollbacks; day-to-day publishing stays with Vercel's own
Git integration, which builds `main` and every pull request already, so a push-time deploy here would
race it and produce two builds for one commit. What *was* verified locally, before any of this was
pushed: every YAML file parses; every `run` block passes `bash -n` (with `${{ … }}` expressions
replaced by a placeholder, which is the only part of the substitution that cannot be checked here); the
backend job's check steps were each **executed** locally under the same `bash -eo pipefail` flags
Actions uses, and all four print green — including the migration-chain step (`tables created: 40`,
`chain ok: 40 tables, users before its dependants, exam_groups before exams, users.erased_at present,
source column widened`, run on 2026-10-20 against the rendered SQL of the 0012 chain) and the full
19-suite loop (**2 054 checks, 0 failures**, re-run on 2026-10-20 after the erasure and exam suites
landed; the 2026-10-21 re-run is the row in the test-runs section above, where one live TTS call fails on
Google's free-tier quota and the other 2 054 pass); the security job's `repository` steps were executed the same way and
both exit 0. `pip-audit` is the one command in the three files that has never been run here — it is not
installed in this venv and installing it was not the point of the session — and `npm audit` was run,
which is where the `braces` finding comes from.

### SQLite → Postgres

```bash
cd backend
./.venv/Scripts/python.exe scripts/migrate_sqlite_to_postgres.py --dry-run   # plan, writes nothing
./.venv/Scripts/python.exe scripts/migrate_sqlite_to_postgres.py \
    --from ./careerguide.db --to "postgresql+psycopg://user:pass@host:5432/db"
```

Copies in `Base.metadata.sorted_tables` order — the order that respects the foreign keys, which is the
one that matters when the target is an engine that enforces them — in batches of 500, inside one
transaction, then restarts every `id` sequence above the highest value it moved. The catalogue tables
the seeder owns (careers, resources, scholarships, institutions, study countries/services/universities,
`assessment_questions`) are left alone when the target already holds the same count, and `--replace-seed-tables`
overrides that. The order of operations is the design: **ids must survive** (a session token points at
a `users.id`), so rows go before sequences; the seeder must not race the copy, so a target that already
has its catalogue is recognised rather than re-seeded.

It refuses rather than half-migrates, and says what it refused: no source file, no target, a target that
is not Postgres, a target with no tables at all (it prints the `alembic upgrade head` to run first), a
target already holding people's rows, a seed clash without the override flag. Before copying anything
it runs a preflight that reads each column's **actual** width on the target against what the source
holds and stops on `table.column: declared N characters, holding M`.

That preflight exists because of what this migration found. `InterestObservation.source` was declared
`String(16)` and the application writes `"interest_activity"` into it — 17 characters. SQLite never
mentioned it; Postgres raised `StringDataRightTruncation` halfway through the copy. The model now says
`String(32)` and migration `0009_observation_source_width` widens the column on both engines: SQLite
through `batch_alter_table` and only online, Postgres through a plain `op.alter_column` that also
renders under `--sql`, which is how the CI job proves the widening without a server. The dispatch is
itself a test finding — the first version broke `alembic upgrade head --sql`, because a batch alter
cannot run in offline mode.

Verified on a real Postgres 17, 2026-10-19: **672 rows** moved, **26** `id` sequences restarted, the
target left at revision `0009_observation_source_width`, an account created before the move still
signs in with its own device id on the migrated database and its child's chat reads back word for word,
and the next new account took id **40** after a maximum of 39. `careerguide.db` stays on disk afterwards
— it is the only copy of what was there before — and it stays out of Git, which `security.yml` now
checks every week instead of trusting this document.

### Backing up the database

`backend/scripts/backup_db.sh` takes one dump of the database this app is pointed at. The reason it
exists is a single fact: every answer a child has typed, every conversation and every observation a
recommendation cites lives in one Postgres database with no second copy. The compose file puts that
database on a named volume, which survives a container being recreated and does not survive a disk,
a `docker volume rm`, or a `DROP TABLE`.

```bash
cd backend
sh scripts/backup_db.sh --dry-run                      # which database, which file, writes nothing
sh scripts/backup_db.sh                                # into ./backups, keeps the last 14
sh scripts/backup_db.sh --dest /mnt/nas/careerguide --keep 30
```

It writes PostgreSQL custom format (`pg_dump -Fc`) rather than a `.sql` because that is the only
format that is compressed *and* selective: `pg_restore --list` shows the tables and a restore can
bring back one table instead of the whole database. The target is resolved in this order, and the
order matters because a scheduled job has no terminal that sourced anything:

1. `DATABASE_URL` — the app's own variable, read from `backend/.env` when the shell does not already
   have it. The backup follows the same setting that decides what the API reads, so it cannot
   quietly dump a different database than the one in use. A SQLite URL is *refused* with the
   `sqlite3 … ".backup …"` command printed, because `pg_dump` has no idea what a `.db` file is.
2. The libpq variables (`PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`), or the `POSTGRES_*` names
   `docker-compose.yml` uses, mapped onto them. This is how the `db-backup` service works.
3. The running container: find it with `docker ps`, run `pg_dump` **inside** it with that
   container's own credentials, copy the archive out with `docker cp`. This is the Windows path —
   there is no `pg_dump` on this machine and the script says so instead of pretending. It uses
   `docker ps` rather than `docker compose ps` deliberately: compose refuses to even parse the file
   without the project directory and its `.env`, which is a thing to ask of a person and not of a
   cron job.

Rotation deletes only files named `careerguide-*.dump` inside the destination, and only *after* the
new archive has been read back — a run that fails can never be the reason the last good backup
disappeared. A dump under 1 KB is kept as `<name>.failed` and the script exits non-zero, because a
truncated archive is worse than no archive: it "succeeds" and restores into nothing.

Scheduling — compose has no clock, so the cron line lives on the host:

```cron
# /etc/cron.d/careerguide — one dump a day, kept out of the round hours on purpose
17 2 * * *  cd /srv/careerguide && docker compose run --rm db-backup >> /var/log/careerguide-backup.log 2>&1
```

Off the machine the same day, or it is not a backup — a copy on the same disk protects against a bad
`DELETE` and nothing else:

```bash
rsync -a --del /srv/careerguide/backups/ restic@nas:/offsite/careerguide/
```

On Windows the equivalent is Task Scheduler running `sh scripts/backup_db.sh` through Git Bash; the
`db-backup` service is the version that does not care what the host is. It is behind a `backup`
profile and writes into its own named volume (`db-backups`), so `docker compose down` — which removes
containers, not volumes — cannot take the last backup with the stack.

Verified on this machine on 2026-10-20, against the running compose stack (Postgres 17.11, the 11
accounts and 510 universities that were in it at the time):

* **libpq path** — `docker compose run --rm db-backup`: `242924 bytes, 334 archive entries, 38 of
  them holding rows`, written into the new `db-backups` volume, rotation reporting `keeping 14`.
* **the restore, for real** — the archive was restored into a scratch database (`createdb
  restore_check && pg_restore --no-owner -d restore_check …`) inside the same container: **38 base
  tables**, `careers` 55/55, `users` 11/11, `auth_tokens` 13/13, `study_universities` 510/510,
  `assessment_questions` 75/75, and `alembic_version` reading `0009_observation_source_width` in the
  copy. Then `dropdb restore_check`. Listing an archive proves it opens; only this proves it restores.
* **container path from Windows** — the same 242,924 bytes and the same 334 entries, taken by
  `docker exec` with no `pg_dump` on the host, verified inside the container before the copy out.
* **the refusals** — a SQLite `DATABASE_URL`, a `mysql://` URL, an unknown option, and a machine with
  none of the three above (each exits non-zero with the sentence printed above rather than an empty
  file).

Two bugs came out of testing it, both worth naming because they are the two ways a backup script
lies:

1. The verifier counted `pg_restore --list | grep -c '^TABLE DATA'`. That anchor matches nothing —
   the line is `<dump id>; <catalog id> <oid> TABLE DATA <schema> <table> <owner>` — so **every good
   backup was reported as unusable**, and had the check been the other way round it would have
   reported every *broken* one as fine.
2. `docker exec <c> pg_restore --list /tmp/x.dump` silently became `C:/Users/…/Temp/x.dump`, because
   Git Bash rewrites an argument that starts with `/` before `docker.exe` sees it. The dump itself had
   worked, so the failure looked like a corrupt archive. Every path that lives inside the container
   now goes through a single-quoted `sh -c` string.

What is **not** covered, stated plainly: no cron has ever fired here (this is a laptop, and the line
above is a template for the server, not a claim about it); nothing has been copied off this machine;
a hosted database (Supabase, Neon, RDS) is that provider's backup story, and this script's `url` mode
will dump one if it is reachable and the local `pg_dump` is not older than the server; Redis holds
only rate-limit counters and is deliberately not backed up; and generated speech is not in the dump
because it is not in the database — the app re-renders it on request (see §1).

## 8. Housekeeping

* Reset local data: delete `backend/careerguide.db` and restart uvicorn (catalogue re-seeds,
  accounts are dropped). The dev database holds throwaway accounts created while testing.
* Schema: a database that predates `migrations/versions/0003_clerk_link.py` still needs that ALTER
  before the email sign-in can store anything. `alembic upgrade head` is the documented way. On a
  dev database running with `DB_AUTO_SETUP` on, the app's own startup `schema_sync` would attach the
  two nullable Clerk columns by itself and log the fact — which is exactly the drift Alembic exists
  to prevent, and it does not happen at all on a deployment that sets `DB_AUTO_SETUP=false`.
* Generated speech is never written to disk, so there is no `backend/media/` to clean up.
* Backups: `scripts/backup_db.sh` on a schedule, kept off the machine (§7). The housekeeping half is
  the drill — restore the newest dump into a scratch database every quarter and read a row back. A
  directory full of archives nobody has opened is not a backup, it is a folder of maybes.
* `frontend/AGENTS.md` and `frontend/README.md` came with the Next.js scaffold.
