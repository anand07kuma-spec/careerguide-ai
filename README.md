# CareerGuide AI

Career exploration for Indian students (class 3–12) and their parents. A student talks or types
with a guide in English, Hindi or Hinglish, explores careers, gets **exploratory** suggestions
(never a verdict), builds study plans, and decides what — if anything — a linked parent may see.

| Folder | What it is |
| --- | --- |
| `frontend/` | Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4 |
| `backend/` | FastAPI + SQLAlchemy: catalogue, conversations, AI provider, Edge/Azure TTS, auth, consent |

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
`hosts`) or **http://localhost:3000**. Both work; logins live in browser storage *per address*, so
pick one.

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
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | backend | `demo` / empty / empty | Any OpenAI-compatible provider |
| `AI_BASE_URL` | backend | `https://api.openai.com/v1` | Swap for a compatible gateway |
| `TTS_PROVIDER` | backend | `auto` | `auto` · `edge` · `azure` |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` | backend | empty | Required for voice on a cloud host (see §3) |
| `TTS_VOICE_EN` / `TTS_VOICE_HI` | backend | `en-IN-NeerjaNeural` / `hi-IN-SwaraNeural` | Same ids on both speech services |
| `TTS_TIMEOUT_SECONDS` | backend | `25` | Synthesis timeout |
| `SESSION_TOKEN_TTL_HOURS` | backend | `720` | Opaque device tokens in `auth_tokens` |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | `http://localhost:8000` | API origin the browser calls (baked at build time) |

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

### Real AI model

```
AI_PROVIDER=openai
AI_API_KEY=<key, server-side only>
AI_MODEL=<model name>
```

Restart uvicorn. `/api/health` then reports `demo_mode: false` and the "Demo guide answer" labels
disappear. Everything else works either way.

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

`TTS_PROVIDER`: `auto` uses Azure when key **and** region are set, else the free Edge endpoint;
`edge` / `azure` force one. Both return the same mp3, the voice ids are the same Microsoft neural
voices, and the chain is server audio → browser `speechSynthesis` → readable text. No extra
dependency (plain `httpx`). What is spoken is the first `MAX_SPOKEN_CHARS` (1200) characters after
markup is stripped, so a long reply is shortened, never rejected. `azure` with a missing key fails
every spoken reply naming `AZURE_SPEECH_KEY` instead of quietly trying Edge — a broken setup should
look broken.

Honest status: Edge TTS produces real audio **from a home connection**. Microsoft answers `403` to
datacenter egress IPs, so a deployed site is expected to fall back to the browser's own voice —
which the screen says out loud. `backend/vercel.json` now asks for `bom1`, but **no real call has
been recorded on the deployed instance yet** (`/api/health` → `tts_last_attempt.checked_at` is
`null`, which is *not* the same as working). To get the Microsoft voices reliably, add an Azure key:

1. portal.azure.com → Create a resource → **Speech** (not *Cognitive Services*), tier **F0**,
   region e.g. **Central India**.
2. Resource Management → **Keys and Endpoint** → copy **Key 1** and note the region string
   (`centralindia`). A key only works in its own region — a mismatch answers `401`.
3. Hand it to the server only, then redeploy (env changes do not apply to an existing deployment):

```bash
cd backend
npx vercel env add AZURE_SPEECH_KEY production      # paste, Enter, Ctrl-D
npx vercel env add AZURE_SPEECH_REGION production
git commit -am "…" && git push origin main           # or: npx vercel redeploy <url>
```

Proof, not configuration: ask for one spoken reply, then read

```bash
curl https://careerguide-api-omega.vercel.app/api/health
# "tts_provider": "microsoft-azure-tts", "tts_last_attempt": {"ok": true, …}
```

`ok: false` means `reason` holds the readable failure and the student is hearing the browser voice.
Settings → Language and voice shows the same answer, with a **Test the voice** button that asks the
server for a real clip.

Cost and privacy:

* F0 is free up to 500,000 characters/month (~3,000 spoken replies of 150 words), then stops until
  the next month.
* **On the free tier Microsoft may use submitted text to improve its service** (not on a paid tier).
  The text sent is the guide's reply — never the student's microphone. If sending replies to a speech
  vendor is unacceptable for children, keep the deployed site on the browser voice; that path needs no
  key and sends nothing.
* `scripts/tts_provider_test.py` covers all of this offline: SSML escaping of conversation text, the
  key travelling as a header rather than in a URL or the spoken body, `401`/empty/timeout messages
  that name neither the credential nor the reply, provider choice, and what `/api/health` reports.

---

## 4. Screens

| Route | Purpose |
| --- | --- |
| `/` | Landing, including "What CareerGuide AI will not do" |
| `/onboarding` | One question — student or parent — optional nickname, two consent confirmations. Ends by showing the come-back code |
| `/login` | Sign in with a come-back code |
| `/app` | Student dashboard: journey counts, directions worth exploring, saved careers, next step |
| `/app/call` | Voice call — 10 explicit states, captions, typed fallback, microphone only while listening |
| `/app/chat` | The same conversation by typing, with dictation and read-aloud |
| `/app/careers`, `/app/careers/[slug]` | Career explorer and full career detail |
| `/app/interests` | One gentle question at a time; answers become early signals, not a fixed profile |
| `/app/journey` | Timeline of conversations, interests, saves and plans — counts, not scores |
| `/app/plans` | Student-owned study plans with per-step status |
| `/app/reports` | Exploratory report, printable, with "what we still don't know" always shown |
| `/app/resources` | Free learning resources |
| `/app/scholarships` | Financial-guidance leads + "how to check a scheme is real" checklist |
| `/app/institutes` | Sample directory; sponsored entries badged, order explicitly not a ranking |
| `/app/settings` | Six icon rows, each opening a panel: language & voice, profile, privacy & consent, family access, sign-in code, about this build |
| `/parent` | Parent dashboard: summary not surveillance, guidance, access management |

### Profile facts, language, sign-in

`services/profile_facts.py` gathers the rest of a profile inside the chat — `/onboarding` asks no
factual question at all.

* One missing fact at a time, where it matters: class and age early, where the student studies once a
  theme exists, cost only at practical next steps. A class or age is accepted only on the turn the
  guide asked, or in a reply of ≤7 words, so a misread cannot silently steer a recommendation.
* Facts are stored as short fixed descriptions, not the child's sentences, and never overwrite a field
  that already has a value. The reply returns them as `profile_updates`; the bubble shows
  "Saved: Class 8". Unknown age is treated as the youngest band (6–8).
* `services/language.py` classifies every message as `en`, `hi` or `hinglish` (Devanagari ≥20% of
  letters → Hindi; romanised-Hindi words from a curated lexicon → Hinglish). If it differs from the
  session's language, the session switches and the TTS voice switches with it. Conversations open in
  the account's language, which defaults to Hinglish. Nothing is inferred from voice, accent or
  speaking speed. **Only the conversation, the interest questions and the spoken voice follow the
  student**: navigation, dashboard, journey, reports, recommendations, parent guidance and the whole
  career/resource/scholarship/institute catalogue are English-only, there are no Hindi career titles,
  and dictation has no Hinglish locale (`hi-IN` / `en-IN`).

**Sign-in has no email, phone or password.** Onboarding ends with a 15-character **come-back code**
(alphabet without `O I 0 1`), shown once, replaceable from Settings — a new code kills the old one
instantly. Only derived values are stored: `comeback_index` (first 48 hex of an unsalted SHA-256, so
the server can find the row) and `comeback_hash` (salted PBKDF2-SHA256, 210,000 iterations, compared
with `hmac.compare_digest`). The code cannot be recovered from the database. Wrong and unknown codes
get an identical message, so the endpoint cannot enumerate accounts. **Lose the code, lose the
account** — there is deliberately no recovery path.

Deploying this onto an existing database needs those two nullable columns (`create_all` never alters a
table): `scripts/db_init.py` adds missing nullable columns and their index, and drops or rewrites
nothing unless `--recreate-if-empty` is passed while every table is still empty.

---

## 5. Verify it yourself

```bash
cd backend
./.venv/Scripts/python.exe scripts/smoke_test.py
./.venv/Scripts/python.exe scripts/login_test.py
./.venv/Scripts/python.exe scripts/conversation_facts_test.py
./.venv/Scripts/python.exe scripts/tts_provider_test.py
./.venv/Scripts/python.exe scripts/serverless_guard_test.py
./.venv/Scripts/python.exe scripts/schema_fit_check.py
cd ../frontend && npx tsc --noEmit && npx eslint src && npm run build
```

Last full run (2026-10-14), on this machine:

| Suite | Result |
| --- | --- |
| `smoke_test.py` — consent gates, server-side ownership, conversations, recommendations, plans, reports, transcript deletion, logout | **97 passed, 0 failed** |
| `login_test.py` — come-back codes | **59 passed, 0 failed** |
| `conversation_facts_test.py` — the guide asking for facts inside the chat | **14 passed, 0 failed** |
| `tts_provider_test.py` — SSML escaping, key as header, error messages, provider choice, `/api/health` | **45 passed, 0 failed, 1 skipped** (its live call needs a real Azure key; it prints `SKIP` rather than pretending) |
| `serverless_guard_test.py` — the no-database shape | **10 passed, 0 failed** |
| `schema_fit_check.py` | 182 seeded values measured, **0 columns too short** |
| `tsc --noEmit`, `eslint src` | clean |

Walked in a real browser with a signed-in session: onboarding → consent gate → dashboard, a Hinglish
reply that learned a class and showed the badge, chat send → reply → spoken audio (an 8.8 s clip
decoded from the data URL), call start → greeting → typed answer → spoken reply → end, voice-consent
gate, career search + save, interests, plan + step status, report generation, resources /
scholarships / institutes, parent share-code linking. No console errors on those routes.

Still needs your own testing:

* **Microphone speech-to-text** — the Web Speech path and its failure states are wired, but a
  blocked-microphone browser cannot prove capture. Needs a visible window where you allow the mic;
  Chrome/Edge yes, Firefox/Safari inconsistently.
* **Hearing the audio** and Hindi voice quality — no speakers here.
* **Layouts at ≥1024 px** — the narrow layout and the ☰ drawer were measured at 510 px; desktop
  sidebar was not visually confirmed. Keyboard activation of ☰ was not driven end-to-end (the
  automated browser's key events do not trigger default button activation).
* **Azure voice on the deployed site** (§3) and **real model replies** (needs a key).
* **This is not full-duplex streaming audio** — one voice speaks at a time and the call screen says
  so. Edge TTS needs internet; it is not an offline guarantee.

---

## 6. Rules the code enforces (not only the UI)

* Access is checked server-side against the session token: a parent cannot read another family's
  data by changing an id in a request.
* Consent is recorded per scope and gates voice and history; transcripts can be deleted by the
  student. Raw microphone audio is never stored, nothing records in the background, and no
  monitoring happens without an explicit, visible session.
* Personal data is minimised: no email, phone, exact location, school address, bank details or
  financial documents.
* A career suggestion is never influenced by payment or sponsorship; sponsored entries are badged.
* Careers, resources, scholarships and institutions are **sample data for exploration** — fees,
  deadlines, placements and scheme rules must be checked on official sites. No guaranteed outcomes.
* **Payments are not implemented at all**, by design, until a real provider is configured and tested.
* Disclosures of danger or abuse get an age-appropriate, safety-focused reply pointing to a trusted
  adult or a local service.

These are features, not a legal opinion: **this build has not had qualified legal review**, and
moving a child's conversations to a hosted database changes where that data lives, who can reach it
and how long it survives. Get review before real children use it. Vercel's Hobby plan is
non-commercial, which fits a personal pilot but not a paid service. Supabase free-tier projects also
pause after a week of inactivity.

## 7. Housekeeping

* Reset local data: delete `backend/careerguide.db` and restart uvicorn (catalogue re-seeds,
  accounts are dropped). The dev database holds throwaway accounts created while testing.
* Generated speech is never written to disk, so there is no `backend/media/` to clean up.
* `frontend/AGENTS.md` and `frontend/README.md` came with the Next.js scaffold.
