# CareerGuide AI

An AI-assisted career exploration app for Indian students (class 3–12) and their parents.
Students talk or type with a guide in English, Hindi or Hinglish, explore careers, get
exploratory (never definitive) suggestions, build study plans, and choose what — if anything —
a linked parent may see.

This repository holds both halves of the product:

| Folder | What it is |
| --- | --- |
| `frontend/` | Next.js 16 (App Router, Turbopack, TypeScript, Tailwind CSS 4) web app |
| `backend/` | FastAPI + SQLAlchemy service: catalogue, conversations, AI provider, Edge/Azure TTS, auth, consent |

---

## 1. Run it locally

Two processes are needed: the API on port **8000** and the web app on port **3000**.
Open two terminals (Git Bash on Windows).

### Terminal 1 — backend

```bash
cd backend

# once only: create the virtual environment and install dependencies
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

First start creates `backend/careerguide.db` and seeds the sample catalogue
(55 careers, 64 resources, 31 scholarship leads, 32 institution entries). No `.env` file is
required for development — every setting has a working default.

Check it is alive: <http://127.0.0.1:8000/api/health> and the interactive API docs at
<http://127.0.0.1:8000/docs>.

### Terminal 2 — frontend

```bash
cd frontend
npm install
npm run dev
```

Then open **<http://localhost:3000>** — or the friendlier alias
**<http://careerguide.localhost:3000>**, which Chrome, Edge and current Windows resolve to this
machine without editing `hosts`. Both addresses serve the same site; the backend allows both
origins. Note that logins live in browser storage *per address*, so an account created on
`localhost:3000` is not signed in on `careerguide.localhost:3000` — onboard once per address you
use, or keep to one.

Sign-in starts at `/onboarding`; the app asks for no email and no password. Onboarding hands out a
one-time **come-back code** (15 characters, shown once) which signs in at `/login` from any device,
so the account is no longer trapped in one browser. Only a digest of that code is stored — see
*Sign-in codes* below.

If a port is already taken (another project's dev server, for example) Next silently moves to
3001, which then also needs adding to `CORS_ORIGINS`. Freeing 3000 is usually simpler:

```bash
netstat -ano | grep LISTENING | grep ":3000 "   # read the PID in the last column
taskkill //PID <pid> //F
```

To prove the pairing without a browser:

```bash
curl -s http://127.0.0.1:8000/api/health
npm run build     # in frontend/ — type-checks and builds every route
```

### Configuration

Copy the examples only when you want to change defaults:

```bash
cp backend/.env.example backend/.env           # never committed (.gitignore covers it)
cp frontend/.env.example frontend/.env.local
```

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | backend | `sqlite:///./careerguide.db` | Any SQLAlchemy URL; PostgreSQL works unchanged |
| `CORS_ORIGINS` | backend | localhost:3000 | Browser origins allowed to call the API |
| `AI_PROVIDER` | backend | `demo` | `demo` = built-in scripted guide. Any OpenAI-compatible provider otherwise |
| `AI_API_KEY` | backend | *(empty)* | **Server-side only.** Never put it in frontend code or commits |
| `AI_MODEL` | backend | *(empty)* | Model name for the chosen provider |
| `AI_BASE_URL` | backend | `https://api.openai.com/v1` | Swap for a compatible gateway |
| `TTS_VOICE_EN` / `TTS_VOICE_HI` | backend | `en-IN-NeerjaNeural` / `hi-IN-SwaraNeural` | Microsoft neural voices, the same ids on both speech services |
| `TTS_PROVIDER` | backend | `auto` | `auto` / `edge` / `azure` — see [Server-side speech](#server-side-speech-azure) |
| `AZURE_SPEECH_KEY` | backend | *(empty)* | **Server-side only.** No key means the free Edge endpoint is used |
| `AZURE_SPEECH_REGION` | backend | *(empty)* | The Speech resource's region, e.g. `centralindia`; the key only works there |
| `TTS_TIMEOUT_SECONDS` | backend | `25` | Speech synthesis timeout |
| `SESSION_TOKEN_TTL_HOURS` | backend | `720` | Opaque device tokens stored in `auth_tokens` |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | `http://localhost:8000` | API origin the browser calls |

### Using a hosted database

SQLite is the default and needs nothing. To keep the same data in a hosted
PostgreSQL, set `DATABASE_URL` and restart uvicorn. Type the value into the file
yourself; never paste it into a chat, a screenshot or a commit, because it contains
the database password. The app puts the right driver on the URL itself —
`app/config.py` turns a plain `postgresql://…` into `postgresql+psycopg://…`, the only
PostgreSQL driver in `requirements.txt` — so a connection string copied from any host
works as written.

**The route that is actually used for the deployed site** is a Vercel marketplace
database, which needs no separate account and writes the variable for you:

```bash
cd backend
npx vercel install prisma/prisma-postgres      # opens a browser to accept its terms
npx vercel env pull .env.local                # DATABASE_URL lands here
.venv/Scripts/python.exe scripts/db_init.py --from-vercel
```

`--from-vercel` reads the URL from the `.env.local` that `vercel env pull` writes (the
app never loads that file), insists on TLS, creates the tables and seeds the catalogue.
Add `--recreate-if-empty` when a column definition changed — it drops and rebuilds only
while every table still holds zero rows, and refuses the moment there is data. Other
marketplace options work the same way (`npx vercel integration discover postgres`).

**Supabase** works identically, with the connection string typed into `backend/.env`:

1. Supabase dashboard: **Project Settings → Database → Connection string → URI**, with
   **Connection pooling** selected — that endpoint is the one a hosted backend can reach;
   the "Direct connection" host is firewalled to allowed IPv4 addresses. Both pooler modes
   work here (port `5432` session, `6543` transaction); the engine recycles
   connections and avoids prepared statements for that reason.
2. A password containing `@ : /` or `%` has to be URL-encoded, or the URL will not
   parse. Append `?sslmode=require` if the server insists on TLS.
3. Create the schema and seed the catalogue with `scripts/db_init.py`, which is the
   route above and needs the app to hold the password. To create the tables without
   ever giving the password to your machine, paste `scripts/supabase_schema.sql` into
   **Dashboard → SQL Editor** instead — it is generated from `app/models.py` by
   `scripts/make_supabase_schema.py`, so it matches the declared columns exactly. The
   catalogue still needs `db_init.py`, because those rows carry Python-side defaults
   and JSON lists.
4. Confirm what the app actually sees:

   ```bash
   .venv/Scripts/python.exe scripts/db_check.py     # backend/, driver installed
   ```

   It prints the dialect, the server version, the tables and a row count per table,
   with the password masked. `pip install -r requirements.txt` first if the
   PostgreSQL driver is missing.

Supabase republishes **every table in the `public` schema over its REST API**, which the
`anon` key can call without any other credential. This app never uses that door — it talks
to PostgreSQL directly through `psycopg` — so `supabase_schema.sql` ends by enabling row
level security with no policies on every table. The `anon` and `authenticated` roles then
read zero rows, while the app keeps working because it logs in as `postgres`, which owns
the tables and is exempt from RLS. `service_role` bypasses all of it and belongs on a
server only; treat it as a secret and rotate it if it has ever been pasted somewhere public.

One thing to know before trusting any hosted setup: **SQLite silently accepts a string
longer than a column's declared length and PostgreSQL rejects it.** The catalogue was
seeded on SQLite from day one, so a 163-character `institutions.fee_range` row only
failed against real Postgres. `scripts/schema_fit_check.py` measures every seeded value
against its declared column and needs no database at all — run it after touching the
catalogue.

Two things none of this changes. The privacy model is still the app's: consent gates,
server-side ownership checks and transcript deletion all keep working, and nothing is
stored in Supabase Auth or the browser. But moving a child's conversations off your own
machine does change where that data lives, who can reach it and how long it survives,
which is exactly the kind of processing needing qualified legal review before this goes
to real users — see [Honest status](#4-honest-status). Supabase free-tier projects also
pause after a week of inactivity and need to be restored manually.

### Turning on a real AI model

The app ships in **demo mode**: replies are generated by a scripted guide and the UI labels each
one "Demo guide answer", so nobody mistakes the sample for a real model. To use a real model, put
the key in `backend/.env` (not in any source file):

```
AI_PROVIDER=openai
AI_API_KEY=<paste the key here, on the server only>
AI_MODEL=<model name>
```

Restart uvicorn. `GET /api/health` reports `demo_mode: false`, and the demo labels disappear.
Everything else in the app keeps working either way.

### Deploying to Vercel

Two Vercel projects, one repository — Vercel finds the FastAPI `app` in
`backend/app/main.py` and the Next.js app in `frontend/` without configuration.

| Project | Root Directory | Needs in Environment Variables |
| --- | --- | --- |
| `careerguide-api` | `backend` | `DATABASE_URL` (a Postgres URL — without one every data endpoint answers 503), `DB_AUTO_SETUP=false`, `CORS_ORIGINS=https://<frontend-origin>` |
| `careerguide-web` | `frontend` | `NEXT_PUBLIC_BACKEND_URL=https://<backend-origin>` (read at build time, so set it before deploying) |

In each project's Settings → General, set **Root Directory** to the path above.
`.vercelignore` in both directories keeps `*.db`, `.env`, `backend/media/` and
`.venv/` out of the upload — the database holds real conversations and must never
leave your machine that way.

**Root Directory is not optional once the repository is connected to Git.** A project
that builds the repository root finds no `package.json`, no `requirements.txt` and no
Next.js marker, so Vercel's framework auto-detection picks something arbitrary — this
repository was guessed as *Brunch* and every build died with
`sh: line 1: brunch: command not found`. Both projects are connected now:

```bash
npx vercel git connect --project careerguide-api    # from the repository root
npx vercel git connect --project careerguide-web
```

A push to `main` then builds each project from its own directory. Feature branches and
pull requests build *preview* deployments, and those are deliberately kept off the real
data: `DATABASE_URL`, `CORS_ORIGINS` and `DB_AUTO_SETUP` are scoped to **Production**
only, so a preview boots with no database and answers `503` on every data endpoint
(`scripts/serverless_guard_test.py` covers that path). `vercel env rm DATABASE_URL
preview` is how that scope was set; re-adding it to Preview would point a throwaway URL
at real family conversations, which is not what you want.

Order that works:

```bash
# 1. log in (this opens a browser device-auth you complete yourself)
npx vercel login

# 2. backend first, so the frontend has an origin to point at
cd backend && npx vercel link --yes --project careerguide-api

# 3. a database, provisioned on the account — this writes DATABASE_URL for you
npx vercel install prisma/prisma-postgres
npx vercel env pull .env.local
npx vercel env add DB_AUTO_SETUP production        # answer: false

# 4. prepare the schema, then deploy the API
.venv/Scripts/python.exe scripts/db_init.py --from-vercel
npx vercel env add CORS_ORIGINS production         # the frontend origin, once known
npx vercel deploy --prod --yes

# 5. then the frontend
cd ../frontend && npx vercel link --yes --project careerguide-web
echo -n "https://<backend-origin>" | npx vercel env add NEXT_PUBLIC_BACKEND_URL production --type config
npx vercel deploy --prod --yes
```

`npx vercel env add NAME production` with no `--type config` stores a **Secret**: it is
hidden in the dashboard and cannot be read back, which is what a database URL wants.
`npx vercel install` opens a browser for the integration's terms and has to be accepted
there; it also drops agent-skill files next to the project (`.claude/`, `.agents/`,
`skills-lock.json`), which the ignore files exclude.

**What is live right now:** `careerguide-api` at
`https://careerguide-api-omega.vercel.app` (Postgres attached, `/api/health` reports
`"storage": "ready"`) and `careerguide-web` at `https://careerguide-web.vercel.app`,
verified end to end in a real browser — see [Honest status](#4-honest-status). Both are
connected to `github.com/anand07kuma-spec/careerguide-ai`, and the API's production
deployment was built by that Git trigger and re-checked, so a push to `main` now ships
the site without any CLI deploy.

What hosting on serverless functions changed in the code, and what to expect:

* **Speech is no longer a file.** Edge TTS audio used to be written to
  `backend/media/tts/` and served from there. A serverless instance cannot hand
  a file to the next request, and pointing the browser back at a path would mean
  putting the reply's text into a URL that gets logged, so `tts.synthesize()` now
  returns a `data:audio/mpeg;base64,…` URL inside the reply itself. Nothing is
  written to disk and nothing is cached server-side, which means each play
  re-synthesises (~1–2 s) and a spoken reply costs about 30–70 KB of JSON.
* **The schema is prepared out of band.** `DB_AUTO_SETUP=false` stops every cold
  start from running `create_all` and the seed; run `scripts/db_init.py` when the
  catalogue changes.
* **One function, 60 s ceiling.** `backend/vercel.json` sets `maxDuration: 60` on
  the whole API. Connection pools are small (2 + 3 overflow) because each warm
  instance opens its own — which is also why a pooled endpoint (Supabase's
  transaction pooler on port 6543, for instance) is the right shape.
* **Microsoft's free voice does not answer for every cloud server.** Edge TTS works on a
  home connection and returned `403` from Vercel's `iad1` datacenter IPs, so on the deployed
  site the reply arrived with `audio_error` and the browser spoke it with its own
  `speechSynthesis` voice instead. That is a different sound, and the screen says so.
  The API now says which of the two is true rather than guessing: `/api/health` carries
  `tts_last_attempt`, the outcome of the last real synthesis (`ok: null` means nobody has
  asked for audio on that server yet — which is *not* the same as working). The recorded
  voices come back either by moving the function to a region Microsoft does not refuse
  (`backend/vercel.json` currently asks for `bom1`, Mumbai — the same region the students are
  in, and unverified until a deployment reports `tts_last_attempt.ok: true`), or by adding an
  Azure Speech key — see [Server-side speech (Azure)](#server-side-speech-azure).
* **A long reply is shortened, never rejected.** What gets spoken is the first
  `MAX_SPOKEN_CHARS` (1200) characters after markup is stripped, while the endpoint accepts
  replies up to 8000 characters. Rejecting the whole request instead made every long guide
  answer fall back to the browser voice, which read as a broken voice rather than a long
  reply.
* **Still true after deploying:** replies are demo-generated until an AI key is
  configured, and are labelled as such; Edge TTS needs internet and is not an
  offline guarantee; there are no passwords, so a student's account lives in the
  browser that created it, now on a public origin.
* **Before real children use a public URL**, the privacy points in
  [Honest status](#4-honest-status) need a qualified legal review — a deployed
  app is exactly the situation that review is for. Vercel's Hobby plan is
  non-commercial, which fits a personal pilot but not a paid service.

### Server-side speech (Azure)

`TTS_PROVIDER` decides what speaks: `auto` (the default) uses Azure when a key **and** a
region are present, otherwise the free Edge endpoint; `edge` and `azure` force one. Both
transports return the same mp3, so nothing else changes — the spoken reply still arrives as
a `data:audio/mpeg` URL inside the API's answer, the voice ids are the same Microsoft
neural voices (`hi-IN-SwaraNeural`, `en-IN-NeerjaNeural`, …), and the chain stays server
audio → browser `speechSynthesis` → text. There is no new dependency: the Azure call is a
plain HTTPS request on the `httpx` already installed.

Getting a key, and handing it to the server only:

1. portal.azure.com → **Create a resource** → **Speech** (the resource called *Speech*, not
   *Cognitive Services*), pricing tier **F0**, region e.g. **Central India**.
2. In that resource: **Resource Management → Keys and Endpoint**. Copy **Key 1** and read
   the **Location/region** string shown there, e.g. `centralindia`. The key only works in
   the region it was created in — a mismatch answers `401`.
3. Give it to the backend, never to the browser or a commit:

```bash
cd backend
npx vercel env add AZURE_SPEECH_KEY production      # paste the key, Enter, then Ctrl-D
npx vercel env add AZURE_SPEECH_REGION production   # e.g. centralindia
git commit -am "…" && git push origin main          # a new deployment is required:
                                                    # env changes do not apply to a
                                                    # deployment that already exists
npx vercel redeploy <deployment-url>                # or rebuild the current commit
```

Locally, the same two names go in `backend/.env` (gitignored) and the running uvicorn
process has to be restarted to pick them up.

Check it took:

```bash
curl https://careerguide-api-omega.vercel.app/api/health
# "tts_provider": "microsoft-azure-tts", "tts_ready": true
```

`tts_ready` only says the key and region are present. Ask for proof: send one message with
*Speak replies* on and read the same endpoint again —

```bash
# "tts_last_attempt": { "checked_at": "…", "ok": true, "provider": "microsoft-azure-tts", … }
```

If `ok` is `false`, `reason` holds the readable failure and the browser voice is what the
student is hearing. Settings → Language and voice has the same answer plus a **Test the
voice** button that asks the server for a real clip.

What this costs and what it means for privacy:

* **F0 is free up to 500,000 characters per calendar month**, which is roughly 3,000 spoken
  replies of 150 words. Above that the resource stops answering until the next month (or
  moves to a paid tier).
* **On the free tier Microsoft may use the submitted text to improve its service.** For a
  paid tier it does not. The text being sent is the guide's reply — not the student's
  microphone, and not raw conversation, since only the reply is spoken. If sending replies
  to Microsoft at all is unacceptable for children, leave `TTS_PROVIDER=edge` off the
  deployed site and let the browser speak; that path needs no key and sends nothing to a
  speech vendor.
* `TTS_PROVIDER=azure` with a missing key fails every spoken reply with a message naming
  `AZURE_SPEECH_KEY`, instead of quietly trying Edge and returning `403` — a broken setup
  should look broken.
* `scripts/tts_provider_test.py` (37 checks) covers this without spending anything: SSML
  escaping of conversation text, the key travelling as a header rather than in the URL or
  the spoken body, `401`/empty-body/timeout messages that leak neither the credential nor
  the reply, provider selection, and what `/api/health` reports. Its one live check is
  skipped unless the shell running it holds a real key, and it says so when it skips.

### How the app learns the rest of a profile

`/onboarding` asks one question only — student or parent — because the remaining facts change as
a child grows and are not something a first screen should demand. `backend/app/services/
profile_facts.py` is what gathers them during the conversation instead:

* The guide asks for **one missing fact at a time**, at the stage where the answer matters:
  class and age band early, where the student studies once the chat has a theme, and cost only
  when it reaches practical next steps. Each ask is phrased as a single question, so the
  "exactly one question per reply" rule holds.
* An answer is stored only when it is usable: `class-9`, `ninth class`, `कक्षा ९` count; a stray
  number in an unrelated sentence does not. A class or age is read only on the turn the guide
  asked for it (or in a reply of seven words or fewer), so a misread can never silently steer a
  recommendation.
* Facts are written as **short fixed descriptions**, not the child's sentences — "Studies at a
  government school.", "The family said cost is a constraint, so low-cost and free paths come
  first." Nothing overwrites a field that already has a value, and a fact is asked at most once
  per conversation.
* The chat returns what it stored as `profile_updates`, and the reply bubble shows it as a
  "Saved: Class 8" badge, so storage stays visible rather than silent. A class also fills the age
  band (`class-8` → `11-12`), which is what chooses the conversation's depth.
* Unknown age is treated as the youngest band (6–8), the protective default, until the guide
  learns the class.

### Which language the guide uses

The guide answers in the language the student actually uses, message by message — it does not
stay in whatever language the account was created with.

* `backend/app/services/language.py` classifies each incoming message as `en`, `hi` or `hinglish`:
  a Devanagari share of at least 20% of the letters means Hindi, romanised-Hindi words from a
  curated lexicon (`mujhe`, `pasand`, `kyun`, …) mean Hinglish, and anything else is English. The
  lexicon deliberately excludes plain English words so "I like playing football" is not misread.
* When that answer differs from the conversation's language, the session switches to it, and the
  switch also picks the text-to-speech voice (`hi` → `hi-IN-SwaraNeural`, `hinglish`/`en` →
  `en-IN-NeerjaNeural`). Switching back mid-call is normal and supported.
* A conversation **opens** in the account's language, which now defaults to Hinglish
  (`UserSettings.language`, the value onboarding saves, and `SessionStartIn.language`). Settings →
  Language changes it, and the guide still follows the student from the first message onward.
* The reply carries its language in `POST /api/conversations/{id}/messages` (`language`), so the
  chat and call screens use the right locale for browser-voice fallback and dictation.
* Interest prompts are served per language: `GET /api/interests/prompts?language=hi|hinglish|en`.
* With a real model, the system prompt in `app/services/prompts.py` tells it to mirror the
  student's latest message and never mix scripts inside one sentence.

Honest limits: only the conversation, the interest questions and the spoken voice follow the
student. The rest of the interface (navigation, dashboard, reports, recommendations, parent
guidance, career/scholarship/institute copy) is English only, the career catalogue has no Hindi
titles, and Web Speech dictation has no Hinglish locale — it listens in `hi-IN` or `en-IN`.
Nothing is ever inferred about a student from their voice, accent or speaking speed; only the
words they typed or said decide the language.

---

## 2. What each screen is

| Route | Purpose |
| --- | --- |
| `/` | Landing page, including "What CareerGuide AI will not do" |
| `/onboarding` | One question — student or parent — plus an optional nickname and the two consent confirmations; everything else is gathered in conversation. Ends by showing the one-time come-back code |
| `/login` | Sign in with a come-back code. Uppercases and groups what you type, and says so when a code simply does not exist |
| `/app` | Student dashboard: journey counts, directions worth exploring, saved careers, next step |
| `/app/call` | Voice call screen — 10 explicit states, captions, typed fallback, microphone only while listening |
| `/app/chat` | The same conversation by typing, with dictation and read-aloud as options |
| `/app/careers`, `/app/careers/[slug]` | Career explorer (search, categories, interest themes) and full career detail |
| `/app/interests` | One gentle question at a time; answers become "early signals", never a fixed profile |
| `/app/journey` | Timeline of conversations, interests noted, saved careers and plans — counts, not scores |
| `/app/plans` | Student-owned study/skill plans with per-step status |
| `/app/reports` | Exploratory career report, printable, with "what we still don't know" always shown |
| `/app/resources` | Free learning resources |
| `/app/scholarships` | Financial-guidance leads with a "how to check a scheme is real" checklist |
| `/app/institutes` | Sample directory; sponsored entries are badged and the order is explicitly not a ranking |
| `/app/settings` | Six icon rows that open a panel each: language and voice, profile, privacy and consent, family access, sign-in code, about this build |
| `/parent` | Parent dashboard: summary not surveillance, guidance for common worries, access management |

### Signing back in

An account can be reached again with a **come-back code** — 15 characters from an alphabet with no
`O`, `I`, `0` or `1`, so a copied code cannot be misread. The code is generated at the end of
onboarding, shown exactly once, and can be replaced any time from Settings → Sign-in code; making a
new one switches the old one off immediately.

Only derived values are stored, in two new nullable columns on `users`:

* `comeback_index` — the first 48 hex characters of an unsalted SHA-256 of the normalised code,
  indexed so the server can find which row to check;
* `comeback_hash` — a salted PBKDF2-SHA256 digest (210,000 iterations) compared with
  `hmac.compare_digest`.

The code itself is never recoverable from the database, and no email, phone or password column was
added. There is deliberately no rate limiter: ~100 ms of PBKDF2 per guess makes online brute force
pointless, and a serverless function cannot keep an in-memory counter honest. A wrong code and an
unknown code return the identical message, so the endpoint cannot be used to enumerate accounts.

An existing database needs those two columns before this code is deployed — `Base.metadata.create_all`
never alters a table that already exists, so run:

```bash
cd backend
npx vercel env pull .env.local          # or point DATABASE_URL at the target database
./.venv/Scripts/python.exe scripts/db_init.py --from-vercel
```

`scripts/db_init.py` adds only missing nullable columns and their index; it never drops or rewrites
anything unless `--recreate-if-empty` is passed while every table is still empty. Local SQLite setup
does this automatically at startup when `DB_AUTO_SETUP=true`.

`scripts/login_test.py` covers the whole flow — format and entropy, what is and is not stored, sign-in
returning a usable session, rotation killing the old code, legacy accounts with no code, parent versus
student codes, the stale-schema repair itself, and the identical refusal for wrong and unknown codes.

---

## 3. Verifying it yourself

```bash
cd backend && ./.venv/Scripts/python.exe scripts/smoke_test.py
cd backend && ./.venv/Scripts/python.exe scripts/login_test.py
```

96 checks run the whole API against a throwaway database — consent gates, server-side ownership
(a parent cannot read another family's data by changing an id), conversation pipeline,
recommendations, plans, reports, transparency rules, transcript deletion, logout.
It prints each check and exits non-zero on any failure.

59 more checks cover sign-in alone: the come-back code format and entropy, the fact that no readable
copy of it is stored, a session returned by `/api/auth/login`, rotation killing the old code, legacy
accounts that never had one, and the schema repair that adds the columns to an older database.

---

## 4. Honest status

Tested and working in this environment:

* Production build: TypeScript clean, 19/19 routes generated.
* Backend smoke suite: **96 passed, 0 failed**, plus `scripts/conversation_facts_test.py`:
  **14 passed, 0 failed** (the guide asking for facts inside the chat).
* Walked in a real browser with a logged-in session: onboarding end-to-end (the single
  role question → consent gate → signed-in dashboard), the conversation learning a class from
  a Hinglish reply and showing it as a "Saved: Class 8" badge, dashboard with live data,
  chat send → reply → spoken audio,
  voice call start → greeting → typed answer → spoken reply → end, voice-consent gate,
  career search + save, interests answering, plan creation + step status, report generation and
  rendering, resources/scholarships/institutes, parent share-code linking and the guidance answer.
  No console errors on any of those routes.
* **Running on Vercel against a real PostgreSQL, walked in a browser on the public URL.**
  `https://careerguide-web.vercel.app` + `https://careerguide-api-omega.vercel.app`, with the
  catalogue in Postgres 17.2 through `psycopg`: `GET /api/health` → `"storage": "ready"`,
  `GET /api/careers/categories` counted real rows, onboarding created a student (consent
  records included), and a Hinglish message got a Hinglish reply labelled
  "Demo guide answer" while the conversation saved "Where you study" and an interest — all
  of it persisted server-side, not in the tab. The test account was then deleted from the
  database (row counts verified back to zero, catalogue untouched). `serverless_guard_test.py`
  adds **10 checks** for the no-database shape and `schema_fit_check.py` keeps the seed content
  inside its declared column lengths.
* Edge text-to-speech produces real audio and plays back with pause/stop controls
  **from a home connection** — Microsoft answers `403` to datacenter IPs, so the deployed
  site falls back to the browser's own voice.
  It now arrives as a data URL rather than a saved file: in the chat screen the
  browser decoded a real 8.8-second clip from it (`loadedmetadata` fired at
  8.784 s, no media error) and the controls moved to the playing state.
* **An Azure Speech transport is wired and verified offline** — `scripts/tts_provider_test.py`,
  **37 checks**: provider selection, region normalisation, SSML escaping of conversation text,
  the key as a header rather than in the URL or the spoken body, `401`/empty/timeout messages
  that name neither the credential nor the reply, and what `/api/health` reports.
  **It has never called Microsoft for real, because there is no key in this environment** — the
  live check in that script prints `SKIP` rather than pretending. Until someone adds
  `AZURE_SPEECH_KEY`, the deployed site still uses the browser's voice.

Needs configuration, or cannot be verified from here — please test these yourself:

* **Microphone speech-to-text.** The Web Speech API path is wired, and its failure states are
  real (this browser reported "microphone blocked for this site" and the UI offered an actionable
  retry). Actual voice capture needs a visible browser window where you allow the microphone, and
  it is browser-dependent: Chrome/Edge support it, Firefox/Safari inconsistently. There is no
  Hinglish locale, so Hindi and English sessions use `hi-IN`/`en-IN` recognition.
* **Hearing the audio** and voice quality in Hindi — no speakers in this environment.
* **Layouts at ≥1024 px.** The narrow (mobile) layout was exercised in the automated browser:
  header, drawer and bottom navigation all render. The ☰ menu was measured at a 510 px viewport —
  it opens above the header and bottom bar (`z-50`), the panel is opaque with a dimmed, blurred
  backdrop, the page behind it is `inert` (not clickable, not focusable), scroll is locked, and
  Escape, the ✕, the backdrop and tapping a menu item all dismiss it, with focus returned to the
  ☰ button except when a menu item moved you to a new page. Desktop sidebar behaviour is built with
  the same Tailwind breakpoints but was not visually confirmed; resize a real window to check.
* **Keyboard activation of the ☰ button** was not driven end-to-end: the automated browser dispatches
  key events that do not trigger a button's default activation, so only the pointer path is proven
  here. It is an ordinary focused `<button>`, so Enter/Space should work in a real window.
* **Real model replies** — needs an AI key (section above).
* **The public voice quality on a phone.** The deployed API no longer produces the Edge
  voices (see the 403 note under [Deploying to Vercel](#deploying-to-vercel)); a student
  hears their browser's or the phone's own voice for the language. Which voice that is,
  and whether Hindi comes out readable, has to be heard on the device.
* This is **not** full-duplex streaming audio: one voice speaks at a time, and the call screen says
  so. Edge TTS needs the internet and is not an offline guarantee.

Known limits of the product itself:

* In demo mode the guide is scripted, and every reply is labelled as such.
* Only the conversation and the interest questions are translated. Navigation, dashboard, reports,
  recommendations, parent guidance and the whole career/scholarship/institute catalogue are English
  only, so a Hindi-speaking student gets Hindi replies inside English-shaped screens.
* Only the conversation follows the student's language. Every other screen — navigation, dashboard,
  journey, reports, recommendations, parent guidance, and the career/resource/scholarship/institute
  catalogue — is English-only, so a Hindi-reading student will still hit English text outside the chat.
* Careers, resources, scholarships and institutions are **sample data** for exploration. Nothing is
  verified against live portals; fees, deadlines and placements must be checked on official sites.
* **Payments are not implemented at all** — by design, until a real provider is configured and tested.
* The session token is device-local, and the come-back code is what survives a changed browser or
  device. There is no email or phone recovery on purpose — so **losing the code means losing the
  account**, and the code must be kept private, since anyone who has it can sign in. Do not use a
  shared or public computer; the onboarding and settings screens say this too.
* Consent, privacy and data-minimisation rules are implemented in the API, not only the frontend, but
  this build has **not** had a qualified legal review. Get one before real children use it.

---

## 5. Development notes

* Reset local data by deleting `backend/careerguide.db` and restarting uvicorn (the catalogue re-seeds,
  accounts are dropped). `backend/careerguide.testdata.db.bak` is a saved copy of an earlier state.
* The dev database currently holds test accounts created while verifying the flows —
  "Asha Test", "Ravi", parent "Mrs. Kumar", and on 2026-10-14 "E2e Voice" plus parent
  "E2e Parent". Sign out from Settings to clear the browser session.
* Generated speech is no longer written to disk: it comes back inside the API reply as a
  `data:audio/mpeg;base64,…` URL (see the serverless notes above), so there is no
  `backend/media/` folder to clean up.
* `frontend/AGENTS.md` and `frontend/README.md` came with the Next.js scaffold and describe that
  framework's conventions.
