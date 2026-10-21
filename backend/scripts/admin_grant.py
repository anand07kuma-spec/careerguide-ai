"""Grant or revoke the one admin flag this app has.

There is no admin signup, no admin role in a request body and no route that can set
this — by design. Every `/api/admin/...` route and `/api/study-abroad/admin/...` re-reads
`users.is_admin` on every call, so the flag has to be set somewhere a person has to
already be standing: on this server, with the database this script opens from the same
`.env` the app reads.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/admin_grant.py --email you@example.com
    .venv/Scripts/python.exe scripts/admin_grant.py --list
    .venv/Scripts/python.exe scripts/admin_grant.py --email you@example.com --revoke

Nothing here checks who is running it, because that is the point: whoever has shell
access to this database already owns every row in it. What the script adds is a
record — one line printed, one flag changed, and no way for a page to ask.

That record is also written into `audit_events`, with no actor account attached to it and
`origin` set to `script`. A change made from a shell is still a change made to who can
run the platform, and a log that only captured the requests would imply that the only
way in was through a page.
"""

from __future__ import annotations

import argparse
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.services import audit  # noqa: E402
from app.services import email as transport  # noqa: E402


def _find(db, address: str):
    return db.scalars(
        select(models.User).where(models.User.contact_email == address)
    ).first()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", help="the account to change, as it is stored")
    parser.add_argument("--revoke", action="store_true", help="take the flag back off")
    parser.add_argument("--list", action="store_true", help="show who holds it now")
    args = parser.parse_args(argv)

    if args.list:
        with SessionLocal() as db:
            holders = list(
                db.scalars(
                    select(models.User).where(models.User.is_admin.is_(True)).order_by(models.User.id)
                )
            )
        if not holders:
            print("No account on this database is an admin.")
            print("Nothing under /api/study-abroad/admin/ will answer to anybody.")
            return 0
        print(f"{len(holders)} admin account(s):")
        for user in holders:
            print(f"  id {user.id:<6} {user.display_name}")
        return 0

    if not args.email:
        parser.error("Give --email, or --list to see who holds the flag.")

    address = transport.normalize_address(args.email)
    if not transport.valid_address(address):
        print(f"That is not an email address: {args.email!r}")
        return 2

    with SessionLocal() as db:
        user = _find(db, address)
        if user is None:
            print(f"No account on this database holds the address {address}.")
            print("Sign up and attach the address in the app first, then run this again.")
            return 1
        if args.revoke:
            if not user.is_admin:
                print(f"id {user.id} — {user.display_name} does not hold admin access.")
                print("Nothing was changed, so nothing was recorded.")
                return 0
            user.is_admin = False
            audit.record(
                db,
                None,
                "user.admin_revoke",
                subject_type="user",
                subject_id=user.id,
                detail="is_admin -> false, from a shell rather than a request",
                origin=audit.SCRIPT,
            )
            db.commit()
            print(f"Removed admin access for id {user.id} — {user.display_name}.")
            print("It takes effect on that account's next request; nothing needs restarting.")
            return 0
        if user.is_admin:
            print(f"id {user.id} — {user.display_name} already holds admin access.")
            print("Nothing was changed, so nothing was recorded.")
            return 0
        if user.email_confirmed_at is None:
            # Granting on a typed-but-unconfirmed address would hand the whole site to
            # whoever owns the string somebody else mistyped. The confirmation link is
            # the only evidence the mailbox belongs to this account.
            print(f"{address} is saved on account {user.id} but never confirmed.")
            print("Open the confirmation link in that mail, then run this again.")
            return 1
        user.is_admin = True
        audit.record(
            db,
            None,
            "user.admin_grant",
            subject_type="user",
            subject_id=user.id,
            detail="is_admin -> true, from a shell rather than a request",
            origin=audit.SCRIPT,
        )
        db.commit()
        print(f"Granted admin access for id {user.id} — {user.display_name} <{address}>.")
        print("It takes effect on that account's next request; nothing needs restarting.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
