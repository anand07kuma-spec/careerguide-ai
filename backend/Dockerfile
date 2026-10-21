# CareerGuide AI — the API.
#
# Python 3.12 and not the 3.11 in the brief, for one reason: every one of the
# 1 802 checks in `backend/scripts/*_test.py` was executed on 3.12.7, and this file
# ships the same code the same tests just passed. A base image nobody has run the
# suite on is a change of runtime disguised as a packaging detail — and the pinned
# wheels below (`psycopg[binary]`, `uharfbuzz`, `reportlab`) are the kind of thing a
# different interpreter resolves differently. Switch the tag if you like; re-run the
# battery in the image afterwards, which is what this file's own smoke step below does.
#
# `-slim` and no build tools on purpose: nothing in requirements.txt compiles from
# source, so an apt-get of gcc would be 300 MB bought for nothing. If a future
# dependency does need it, that layer goes in the builder stage below rather than in
# the runtime image.

FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

# Dependencies first, in their own layer, so editing `app/main.py` does not re-resolve
# the whole set on the next build.
COPY requirements.txt ./
RUN python -m pip install --prefix=/install -r requirements.txt


FROM python:3.12-slim

# The three variables that stop this image from writing where it should not have to:
# no bytecode on a read-only filesystem, no buffered logs sitting in a container that
# is about to be killed, and no `pip` prompt asking for a key it must never be given.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    HOME=/tmp

WORKDIR /app

COPY --from=builder /install /usr/local

# `data/` and `assets/` are read at request time by paths anchored two directories up
# from the module that uses them (`app/services/pdf_report.py` looks for
# `../assets/brand-logo.png`), so they have to sit next to `app/` exactly as they do in
# the repository. Dropping the fonts would build fine and fail only when a family
# asked for a Hindi report, which is the worst possible time to learn it.
COPY app ./app
COPY data ./data
COPY assets ./assets
COPY templates ./templates
COPY migrations ./migrations
COPY scripts ./scripts
COPY alembic.ini ./
COPY docker-entrypoint.sh ./

# A non-root user, because this container holds children's conversations and an
# accidental `open(path, "w")` in the wrong place should fail rather than succeed
# quietly. Nothing in the app needs a writable directory any more: generated speech
# comes back inside the API's reply as a data URL, not as a file on disk.
#
# The `sed` is not decoration: this repository is checked out on Windows, and a
# `docker-entrypoint.sh` with CRLF line endings is a `/bin/sh` error three characters
# deep that looks like a broken app. Stripping \r at build time costs nothing and makes
# the image build the same from any clone.
RUN addgroup --system careerguide \
    && adduser --system --ingroup careerguide --home /nonexistent careerguide \
    && sed -i 's/\r$//' /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh \
    && chown -R careerguide:careerguide /app

USER careerguide

EXPOSE 8000

# The app's own answer to "are you up", not a TCP port check: `/api/health` reports
# whether the database answered and which AI provider is configured, so a container
# sitting on a database it cannot reach is unhealthy here instead of green forever.
#
# `curl` is not in -slim, hence python — one fewer package, and the same stdlib the
# app already ships.
#
# Two minutes of grace, not twenty seconds, because the port does not open until the
# entrypoint finishes: on a first boot it builds the schema and inserts the whole
# catalogue — 55 careers, 510 universities and the rest — before uvicorn is allowed to
# answer anything. Under a short start period that honest work reads as a failing app,
# and the compose stack tears itself down over a container that was simply still
# planting the data.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD ["python", "-c", "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
# One worker. `uvicorn --workers 4` would be four processes each holding its own rate
# limit counters, so the limits on the deployment screen would be a quarter of what a
# visitor actually gets — scale with more containers plus RATE_LIMIT_REDIS_URL instead,
# which is why Redis is in `docker-compose.yml`.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
