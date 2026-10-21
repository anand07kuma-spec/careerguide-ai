"""Writing the operator log, and the only rules about what may go into it.

`app/models.py::AuditEvent` explains why the table holds no request body, no
conversation content and no IP address. This module is where those rules are enforced in
practice, because every admin mutation calls through here rather than constructing a row
itself — which means there is one place to read to know what the log can contain.

Two conventions that are not obvious from the code:

* **Same transaction as the change.** `record` adds a row and does *not* commit. The
  route that called it commits once, so an action and its log entry either both exist or
  neither does. A log that could be rolled back while the change stayed committed would
  show a clean history of things that never happened.
* **No read auditing.** Nothing here is called by a `GET`. Recording that somebody looked
  at a list is surveillance of the operator rather than accountability for a change, and
  it makes the table grow without making it more useful. Deleting a row is still logged,
  because deleting is a change.

`detail` is deliberately a plain string built by the caller with `->`, never a dict: a
dict invites whoever writes the next route to dump the object they were editing, and the
column would hold their reason for doing it.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import AuditEvent, User

# Where the call arrived from. `script` covers the CLI tools in scripts/, which mutate
# the same data and have no token to attribute them to beyond an account id somebody
# typed into a flag.
API = "api"
SCRIPT = "script"


def record(
    db: Session,
    actor: User | None,
    action: str,
    *,
    subject_type: str | None = None,
    subject_id: int | str | None = None,
    detail: str | None = None,
    origin: str = API,
) -> AuditEvent:
    """Queue one log row in the caller's transaction and hand it back unsaved.

    `actor` may be `None` for a mutation with no account behind it — a seeded import, a
    webhook that authenticated itself some other way. Refusing to write the row in that
    case would drop the change or the log depending on which the route cared about more;
    writing it with a null actor and the action name keeps both, and the null is itself
    the signal that something is running without a person.
    """
    event = AuditEvent(
        actor_user_id=actor.id if actor is not None else None,
        # A snapshot, not a join: the account may be closed later, and this row should
        # still say who it was.
        actor_name=(actor.display_name or None) if actor is not None else None,
        action=action,
        subject_type=subject_type,
        subject_id=None if subject_id is None else str(subject_id)[:48],
        # Clipped rather than rejected: a detail that overruns is a bug in the caller's
        # sentence, not a reason to lose the action line next to it.
        detail=None if detail is None else detail[:400],
        origin=origin,
    )
    db.add(event)
    return event
