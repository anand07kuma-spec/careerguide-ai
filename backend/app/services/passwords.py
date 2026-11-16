"""Passwords for the email sign-in: hashing, policy, and reset tokens.

Only this module sees a password in the clear. It hands back an Argon2id digest and,
on a later sign-in, a yes or no; nothing else in the application can read the value
back. That matters because the backend also stores children's profiles and answers,
and a handler that received a password as data is a handler that could put it in a log.

Argon2id with OWASP's baseline parameters — 19 MiB, two passes, one lane. The salt is
generated per password by the library, so two people with the same password have two
unrelated digests, and the work factor is stored inside the digest, which is what lets
`needs_rehash` recognise one made under weaker settings after a future change here.

A reset token is not a password and is not stretched: it is 32 random bytes, which is
beyond guessing, so a SHA-256 digest is enough to make the database row useless to
whoever reads it. The mailed string is the only copy that opens the door, and redeeming
it is what clears the digest.
"""

from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from argon2.low_level import Type

MIN_LENGTH = 10
# Hashing is deliberately expensive; accepting a megabyte of paste would turn a sign-up
# form into a way to spend this server's memory. Well past the longest passphrase a
# person types.
MAX_LENGTH = 200

_HASHER = PasswordHasher(
    time_cost=2,
    memory_cost=19_456,
    parallelism=1,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

# Verified against when no account matches the address, so a caller cannot tell "no
# account" from "wrong password" by how long the answer took.
_DUMMY_HASH = _HASHER.hash(secrets.token_urlsafe(16))

# Nobody's actual password, and short enough to read: the point is to refuse the dozen
# strings every credential-stuffing list starts with, not to run a dictionary attack on
# the person choosing one.
COMMON_PASSWORDS = frozenset(
    {
        "1234567890",
        "12345678901",
        "123456789012",
        "password",
        "password1",
        "password12",
        "password123",
        "passw0rd",
        "qwertyuiop",
        "qwerty12345",
        "letmein123",
        "iloveyou1",
        "welcome123",
        "admin12345",
        "abcd123456",
        "careerguide",
        "careerguide1",
    }
)


def hash_password(password: str) -> str:
    return _HASHER.hash(password)


def verify_password(password: str, stored: str | None) -> bool:
    """True only for the password that made this digest.

    A missing or unreadable digest is a no, not an exception: an account that signs in
    another way has no password to match, and a row edited to something invalid must
    fail closed rather than become a way to skip the check.
    """
    if not stored:
        return False
    try:
        return _HASHER.verify(stored, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def verify_dummy(password: str) -> None:
    """Spend the same work as a real check when the address has no account."""
    try:
        _HASHER.verify(_DUMMY_HASH, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        pass


def needs_rehash(stored: str | None) -> bool:
    if not stored:
        return False
    try:
        return _HASHER.check_needs_rehash(stored)
    except InvalidHashError:
        return False


def normalize_email(value: str) -> str:
    """The address as this database stores it: trimmed and lower case.

    Two spellings of one mailbox have to be one account, or the unique index does
    nothing. Local parts are technically case-sensitive, but no mail provider a family
    here uses treats them that way, and a sign-up that silently made a second account
    for `Asha@…` would be the worse failure.
    """
    return str(value or "").strip().lower()


def password_problem(password: str, email: str = "") -> str | None:
    """Why this password cannot be used, in one sentence, or None if it can.

    The rules are about a password somebody types once and remembers, not about
    squeezing entropy out of them: length, two character classes, and a refusal of the
    handful of strings every list begins with. A screen mirrors these sentences so the
    answer arrives before the request, but this is the check that decides.
    """
    value = password or ""
    if len(value) < MIN_LENGTH:
        return f"Use at least {MIN_LENGTH} characters."
    if len(value) > MAX_LENGTH:
        return f"Use no more than {MAX_LENGTH} characters."
    if not any(character.isalpha() for character in value) or not any(
        character.isdigit() for character in value
    ):
        return "Use at least one letter and one digit."
    lowered = value.lower()
    if lowered in COMMON_PASSWORDS:
        return "That password is easy to guess. Choose something only you would know."
    address = normalize_email(email)
    if address:
        local = address.split("@", 1)[0]
        if lowered in {address, local}:
            return "Choose a password that is not your email address."
    return None


# ------------------------------------------------------------------ reset tokens


def new_reset_token() -> str:
    """32 random bytes as a URL-safe string. Only the mailed copy exists in clear."""
    return secrets.token_urlsafe(32)


def reset_token_hash(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()
