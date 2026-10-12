# CareerGuide AI

An AI-assisted career exploration app for Indian students (class 3–12) and their parents.
Students talk or type with a guide in English, Hindi or Hinglish, explore careers, get
exploratory (never definitive) suggestions, build study plans, and choose what — if anything —
a linked parent may see.

This repository holds both halves of the product:

| Folder | What it is |
| --- | --- |
| `frontend/` | Next.js 16 (App Router, Turbopack, TypeScript, Tailwind CSS 4) web app |
| `backend/` | FastAPI + SQLAlchemy service: catalogue, conversations, AI provider, Edge TTS, auth, consent |

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

Sign-in starts at `/onboarding`; the app asks for no email and no password, so the account lives
in this browser only.

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
| `TTS_VOICE_EN` / `TTS_VOICE_HI` | backend | `en-IN-NeerjaNeural` / `hi-IN-SwaraNeural` | Microsoft Edge text-to-speech voices |
| `TTS_TIMEOUT_SECONDS` | backend | `25` | Speech synthesis timeout |
| `SESSION_TOKEN_TTL_HOURS` | backend | `720` | Opaque device tokens stored in `auth_tokens` |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | `http://localhost:8000` | API origin the browser calls, and the origin that serves generated speech |

### Using a hosted database (Supabase)

SQLite is the default and needs nothing. To keep the same data in a hosted
PostgreSQL, put your Supabase connection string in `backend/.env` and restart
uvicorn. Type the value into the file yourself; never paste it into a chat, a
screenshot or a commit, because it contains the database password.

1. Supabase dashboard: **Connect → Client libraries → Connection string → URI**,
   with **Direct connection** or **Session pooler** selected. Both pooler modes
   work here (port `5432` session, `6543` transaction); the engine recycles
   connections and avoids prepared statements for that reason.
2. Set the value, adding the `+psycopg` driver part:

   ```
   DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@<host>:5432/postgres
   ```

   A password containing `@ : /` or `%` has to be URL-encoded, or the URL will
   not parse. Append `?sslmode=require` if the server insists on TLS.
3. Start the backend once. It creates every table and seeds the career
   catalogue, so a new project is usable immediately.
4. Confirm what the app actually sees:

   ```bash
   .venv/Scripts/python.exe scripts/db_check.py     # backend/, driver installed
   ```

   It prints the dialect, the server version, the tables and a row count per
   table, with the password masked. `pip install -r requirements.txt` first if
   the PostgreSQL driver is missing.

Two things this does not change. The privacy model is still the app's: consent
gates, server-side ownership checks and transcript deletion all keep working,
and nothing is stored in Supabase Auth or the browser. But moving a child's
conversations off your own machine does change where that data lives, who can
reach it and how long it survives, which is exactly the kind of processing
needing qualified legal review before this goes to real users — see
[Honest status](#4-honest-status). Supabase free-tier projects also pause after
a week of inactivity and need to be restored manually.

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
  (`UserSettings.language`, the onboarding picker, and `SessionStartIn.language`). Settings →
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
| `/onboarding` | 4-step wizard: who is using it → about you → your situation → permission and privacy |
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
| `/app/settings` | Language, voice, profile, privacy and data, family access, accessibility, honest limitations |
| `/parent` | Parent dashboard: summary not surveillance, guidance for common worries, access management |

---

## 3. Verifying it yourself

```bash
cd backend && ./.venv/Scripts/python.exe scripts/smoke_test.py
```

94 checks run the whole API against a throwaway database — consent gates, server-side ownership
(a parent cannot read another family's data by changing an id), conversation pipeline,
recommendations, plans, reports, transparency rules, transcript deletion, logout.
It prints each check and exits non-zero on any failure.

---

## 4. Honest status

Tested and working in this environment:

* Production build: TypeScript clean, 19/19 routes generated.
* Backend smoke suite: **94 passed, 0 failed**.
* Walked in a real browser with a logged-in session: onboarding wizard end-to-end (4 steps →
  signed-in dashboard), dashboard with live data, chat send → reply → spoken audio,
  voice call start → greeting → typed answer → spoken reply → end, voice-consent gate,
  career search + save, interests answering, plan creation + step status, report generation and
  rendering, resources/scholarships/institutes, parent share-code linking and the guidance answer.
  No console errors on any of those routes.
* Edge text-to-speech produces real audio (`/media/tts/*.mp3`, ~49 KB) and plays back with
  pause/stop controls.

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
* Auth is a device-local opaque token, so a child's account only exists in that browser. Do not use
  a shared or public computer; that warning is on the onboarding screen too.
* Consent, privacy and data-minimisation rules are implemented in the API, not only the frontend, but
  this build has **not** had a qualified legal review. Get one before real children use it.

---

## 5. Development notes

* Reset local data by deleting `backend/careerguide.db` and restarting uvicorn (the catalogue re-seeds,
  accounts are dropped). `backend/careerguide.testdata.db.bak` is a saved copy of an earlier state.
* The dev database currently holds test accounts created while verifying the flows —
  "Asha Test", "Ravi" and parent "Mrs. Kumar". Sign out from Settings to clear the browser session.
* Generated speech lands in `backend/media/tts/` (gitignored).
* `frontend/AGENTS.md` and `frontend/README.md` came with the Next.js scaffold and describe that
  framework's conventions.
