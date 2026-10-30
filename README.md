# CareerGuide AI

Career guidance for Indian students in class 6–12 and the parents who help them choose.
A student talks or types with a guide in English, Hindi or Hinglish, explores careers and streams,
practices for an interview, and decides for themselves what — if anything — a linked parent may see.

The suggestions are **exploratory, never a verdict**: no guaranteed salary, admission or placement,
and nothing is inferred from a child's voice, accent or typing speed.

## Tech stack

| Layer | Used |
| --- | --- |
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, Pydantic 2, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL (Supabase-ready); SQLite works out of the box locally |
| AI | Groq for replies, Gemini / Azure / Edge TTS for voice, browser Web Speech for listening |
| Tests | 23 backend suites (last full battery: 2 613 checks, 0 failed; its two live TTS calls skip for want of a key on this machine), `tsc` + ESLint + production build, three Hindi validators |

## Quick local setup

Two processes: API on **8000**, web on **3000**. Two terminals (Git Bash on Windows).

```bash
# terminal 1 — backend
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt    # macOS/Linux: pip install -r requirements.txt
./.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** (or `http://careerguide.localhost:3000`, which keeps the same device
across reloads on Windows — pick one and stay on it). The first backend start creates
`backend/careerguide.db` and seeds the catalogue. **No `.env` is required** — every setting has a
working default, and replies are labelled demo-generated until you add an AI key.

Health check: http://127.0.0.1:8000/api/health · interactive docs: http://127.0.0.1:8000/docs

## Full documentation

Everything else lives in **[docs/ARCHITECTURE_AND_TESTS.md](docs/ARCHITECTURE_AND_TESTS.md)**:

- §1 settings, `.env` reference, database and Alembic migrations, wiring a real AI model
- §2 deploying to Vercel, or to Render with a Neon/Supabase Postgres (`render.yaml`, and the full
  production environment-variable list)
- §3 how voice works, and which browser supports what
- §4 every screen and API surface, including the portals and the study-abroad directory
- §5 how to verify it yourself — each suite, what it covers, and what has and has not been run
- §6 the rules the code enforces on the server, not only in the UI
- §7 Docker Compose, CI, the SQLite → Postgres cutover, and backups

`frontend/README.md` and `frontend/AGENTS.md` are untouched Next.js scaffolding docs.

## Demo mode: payments and sign-in

Both features are **built and switched off**, and the app says so on screen rather than pretending:

- **Payments.** The Razorpay checkout, the pricing page and the plan limits all exist, but no
  `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` is set on this project, so the order route answers `503`
  naming the two variables and no card can be charged. Nothing here takes money.
- **Auth.** There is no password and no email login in use. The app recognises the device with an
  opaque device id and a hashed session cookie, and a student can move to another device with a
  come-back code. Clerk email sign-in is fully wired but dormant — its four routes return `503`
  until `CLERK_SECRET_KEY` and a publishable key are set (see §4 of the docs).

Add the keys in `backend/.env` when you are ready; both features turn on from config alone, with no
code change. Until then, treat accounts as single-device and payments as unavailable.

## Please read before using with a real student

This is a working prototype, not a compliance product. It has not had a legal review against the
DPDP Act or any other regime, the legal pages carry placeholder operator details, and the
recommendation catalogue is seeded data with a verification badge that is only lit by a human
attestation. Details in §4 and §6 of the docs.
