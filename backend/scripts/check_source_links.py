"""Ask whether the catalogue's official pages are still the official pages.

    ./.venv/Scripts/python.exe scripts/check_source_links.py --kind career
    ./.venv/Scripts/python.exe scripts/check_source_links.py --kind university --limit 40
    ./.venv/Scripts/python.exe scripts/check_source_links.py --all --timeout 8 --quiet

Three tables point a family at a page: a career's `official_links`, a scholarship's
`official_url`, a university's `official_url`. Those links are the only reason a card can
say "check it here" instead of "believe us", and they were typed in on some day in the past.
Government offices move domain — `dgca.bef.gov.in` and `mocav.nic.in` are two that have
already gone quiet in this very catalogue — and a link that 404s behind a live-looking page
is worse than no link, because it teaches a reader that the app's pointers are decoration.

So this walks the links and reports three things per row: whether the page answers, whether
the address it lands on differs from the one stored, and whether the host it ends up on is
still one of the official suffixes `verify_data.py` will accept as a source.

What it will not do is write anything. It cannot know whether a row's *claim* is right, only
whether its *pointer* is alive, and a green light from here is not a `verified_at`: that
column means a person read the sentence against the page, and only
`scripts/verify_data.py attest` puts it there, one row at a time, from a human who says what
they compared. A sweep that stamped 510 dates from HTTP status codes would be the exact
thing this repository promises a student it does not do.

Network calls are GETs with a browser-ish user agent, because several Indian government
sites answer HEAD or a bare `python-urllib` agent with a 403, and a 403 from a firewall is
not a dead department. Results are grouped by host, so one ministry that is down for
maintenance reads as one line instead of forty.
"""

from __future__ import annotations

import argparse
import pathlib
import socket
import ssl
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
# The same table `verify_data.py` attests into, imported rather than copied: which model is
# a row, which column names it, and which links it points at. A second list that can drift
# away from the one that writes the badge is how a checker starts reporting rows that no
# longer exist.
from verify_data import KINDS, _url_problem  # noqa: E402

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36 careerguide-link-check/1.0"
)

# A certificate problem on the machine running this sweep is not a dead government site, so
# the bundle is the one `httpx` already uses rather than whatever the local store happens to
# hold. Falls back to the platform default where certifi is not installed.
try:
    import certifi

    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # pragma: no cover - depends on the environment
    SSL_CONTEXT = ssl.create_default_context()


@dataclass
class Row:
    kind: str
    identifier: str
    title: str
    urls: list[str]


@dataclass
class Verdict:
    url: str
    status: int | None = None
    final_url: str | None = None
    problem: str = ""
    rows: list[Row] = field(default_factory=list)


def collect(db, kind: str, limit: int | None) -> list[Row]:
    """The rows in list order — alphabetical by title or name, which is the order a student
    meets them in, so `--limit` means "the ones most likely to be seen" and not "any N"."""
    spec = KINDS[kind]
    model = spec["model"]
    id_key = spec["id_column"].key
    stmt = select(model).order_by(model.title if kind == "career" else model.name)
    rows = db.scalars(stmt.limit(limit) if limit else stmt)
    out: list[Row] = []
    for row in rows:
        urls = [u for u in spec["signposts"](row) if u]
        if urls:
            out.append(Row(kind, str(getattr(row, id_key)), spec["name"](row), urls))
    return out


def probe(url: str, timeout: float) -> tuple[int | None, str, str]:
    """(status, final url, problem). `problem` is empty when the page answered."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            return response.status, response.geturl(), ""
    except urllib.error.HTTPError as error:
        # A 4xx/5xx is an answer from the server: the department exists, the page moved or
        # the firewall is unhappy. Only a 404 and a 410 say "this address is wrong".
        return error.code, url, ""
    except urllib.error.URLError as error:
        reason = error.reason
        if isinstance(reason, socket.timeout):
            return None, url, "timed out"
        return None, url, f"no answer ({getattr(reason, 'strerror', None) or reason})"
    except (TimeoutError, OSError) as error:
        return None, url, f"no answer ({error})"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--kind", choices=list(KINDS), default=None)
    parser.add_argument("--all", action="store_true", help="every table, in the order above")
    parser.add_argument("--limit", type=int, default=None, help="first N rows per table")
    parser.add_argument("--timeout", type=float, default=12.0)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--quiet", action="store_true", help="print problems only")
    args = parser.parse_args(argv)

    kinds = list(KINDS) if args.all or not args.kind else [args.kind]

    with SessionLocal() as db:
        rows: list[Row] = []
        for kind in kinds:
            rows.extend(collect(db, kind, args.limit))

    by_url: dict[str, list[Row]] = defaultdict(list)
    for row in rows:
        for url in row.urls:
            by_url[url].append(row)

    dead: list[Verdict] = []
    unresolved: list[Verdict] = []
    moved: list[Verdict] = []
    off_host: list[Verdict] = []
    ok = 0

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {url: pool.submit(probe, url, args.timeout) for url in sorted(by_url)}
        results: dict[str, tuple[int | None, str, str]] = {}
        for url, future in futures.items():
            try:
                results[url] = future.result()
            except Exception as error:  # never let one row kill the sweep
                results[url] = (None, url, f"checker failed ({error})")

    for url, (status, final_url, problem) in sorted(results.items()):
        owners = by_url[url]
        verdict = Verdict(url=url, status=status, final_url=final_url, problem=problem, rows=owners)
        stored_problem = _url_problem(url)
        landed_problem = _url_problem(final_url) if final_url else "it landed nowhere"
        if problem and status is None:
            # Nothing came back at all. That is a statement about this network as much as
            # about the link: several Indian ministry domains answer only inside the
            # country, and a laptop in another region gets silence, not absence. So this
            # bucket is a question to re-ask from a deployment, never an instruction to
            # rewrite a URL.
            unresolved.append(verdict)
        elif status in (404, 410):
            verdict.problem = f"the page is gone (HTTP {status})"
            dead.append(verdict)
        elif stored_problem or landed_problem:
            verdict.problem = landed_problem or stored_problem
            off_host.append(verdict)
        elif urlparse(url).hostname != urlparse(final_url).hostname:
            moved.append(verdict)
        else:
            ok += 1

    total = len(results)
    if not args.quiet:
        print(f"{total} distinct link(s) across {len(rows)} row(s) in {', '.join(kinds)}.")
        print(f"  answering on the stored host : {ok}")
        print(f"  redirecting elsewhere        : {len(moved)}")
        print(f"  not an official host         : {len(off_host)}")
        print(f"  gone (404 / 410)             : {len(dead)}")
        print(f"  silent from here             : {len(unresolved)}")
        print()

    def label(verdict: Verdict) -> str:
        who = ", ".join(f"{row.kind}:{row.identifier}" for row in verdict.rows[:3])
        more = f" (+{len(verdict.rows) - 3} more)" if len(verdict.rows) > 3 else ""
        return f"    {verdict.url}\n        stored for {who}{more}"

    for title, group in (
        ("GONE", dead),
        ("NOT-OFFICIAL", off_host),
        ("MOVED", moved),
        ("SILENT-FROM-HERE", unresolved),
    ):
        if not group:
            continue
        print(f"{title} — {len(group)}")
        for verdict in group:
            state = verdict.problem or f"HTTP {verdict.status}"
            landed = verdict.final_url or ""
            arrow = f" -> {landed}" if landed and landed != verdict.url else ""
            print(f"{label(verdict)}\n        {state}{arrow}")
        print()

    if dead or off_host:
        print(
            "Fix the link first, then run `verify_data.py attest` on the rows above — a "
            "badge earned against a page that answers is a claim; against a page that does "
            "not, it is the thing this app's own disclaimer page promises not to be."
        )
    if unresolved:
        print(
            f"{len(unresolved)} link(s) said nothing to this machine. Re-run this from the "
            "deployed API (or any network inside India) before acting on them — a ministry "
            "that geofences its DNS reads as silence here and as 200 there."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
