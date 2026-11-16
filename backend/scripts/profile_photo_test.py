"""A profile photo: what is accepted, who may touch it, and where it survives.

The picture is the one file this app takes from outside and keeps, so the checks
here are mostly about the boundary rather than the pretty result:

* the bytes are decoded, so a name ending in `.jpg` and a browser claiming
  `image/jpeg` are both ignored in favour of what the file actually is;
* only JPEG, PNG and WebP survive, at a bounded size in bytes and pixels, and what
  is stored is a fresh 512 px square JPEG — which is also why the EXIF a phone
  writes is not in the stored file;
* no route takes an account id, so a second account cannot read, replace or delete
  the first one's picture by editing a URL — proved by doing exactly that and
  checking the first account's bytes did not move;
* a replacement is committed only after the new image is validated and encoded, so
  a refused upload leaves the saved picture exactly as it was — including when the
  database itself refuses the write.

The last sections follow the picture across a reload and a brand-new sign-in, and
through account erasure, because "persistent" is the whole point of the feature.

Runs against a throwaway SQLite database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/profile_photo_test.py
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile
import time
from io import BytesIO

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_profile_photo_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # the throttle is proved in security_test.py

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal, engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ProfilePhoto  # noqa: E402
from app.services.profile_photos import MAX_UPLOAD_BYTES, OUTPUT_EDGE  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)[:200]) if detail and not condition else ''}")


def section(title: str) -> None:
    print(f"\n== {title} ==")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def image_bytes(fmt: str = "JPEG", size: tuple[int, int] = (640, 480), colour=(210, 60, 80)) -> bytes:
    out = BytesIO()
    Image.new("RGB", size, colour).save(out, format=fmt)
    return out.getvalue()


def photo_file(name: str, content: bytes, content_type: str = "image/jpeg") -> dict:
    return {"photo": (name, content, content_type)}


STUDENT = {
    "role": "student",
    "display_name": "Riya",
    "preferred_language": "en",
    "class_level": "class-10",
    "interest_areas": ["drawing"],
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}
PARENT = {
    "role": "parent",
    "display_name": "Mr. Rao",
    "preferred_language": "en",
    "consent_profile": True,
    "consent_voice": False,
    "consent_age": "11-12",
}

client = TestClient(app)
# A client with no cookie jar of its own: the signed-in client above keeps one after
# onboarding, so a "stranger" request has to be made from somewhere that has none.
anon = TestClient(app)
tolerant = TestClient(app, raise_server_exceptions=False)

with client:
    section("1. accounts, and an account that has never had a photo")

    r = client.post("/api/auth/onboarding", json={**STUDENT, "device_id": "photo-device-" + "a" * 20})
    check("a student onboards", r.status_code == 200, r.text[:200])
    token_a = r.json()["token"]
    id_a = r.json()["user"]["id"]
    check("the new profile says there is no photo", r.json()["profile"]["profile_photo_url"] is None, r.json()["profile"])

    r = client.get("/api/profile/photo", headers=auth(token_a))
    check("and reading it answers 404, not an empty image", r.status_code == 404, f"{r.status_code} {r.text[:160]}")
    check(
        "…with a plain refusal rather than image bytes",
        r.headers.get("content-type", "").startswith("application/json") and not r.content.startswith(b"\xff\xd8\xff"),
        r.headers.get("content-type"),
    )

    r = client.post("/api/auth/onboarding", json={**STUDENT, "display_name": "Vikram"})
    check("a second student onboards", r.status_code == 200, r.text[:200])
    token_b = r.json()["token"]

    r = client.post("/api/auth/onboarding", json={**PARENT})
    check("a parent onboards", r.status_code == 200, r.text[:200])
    token_parent = r.json()["token"]

    section("2. nobody without a session, and no parent, can touch a photo")

    for method, path in (("post", "/api/profile/photo"), ("get", "/api/profile/photo"), ("delete", "/api/profile/photo")):
        call = getattr(anon, method)
        r = call(path, files=photo_file("me.jpg", image_bytes())) if method == "post" else call(path)
        check(f"an unsigned-in {method.upper()} is refused", r.status_code == 401, f"{r.status_code} {r.text[:160]}")

    r = client.get("/api/profile/photo", headers=auth(token_parent))
    check("a parent cannot read a photo through this route", r.status_code == 403, f"{r.status_code} {r.text[:160]}")
    r = client.post("/api/profile/photo", headers=auth(token_parent), files=photo_file("me.jpg", image_bytes()))
    check("…nor upload one", r.status_code == 403, f"{r.status_code} {r.text[:160]}")
    r = client.delete("/api/profile/photo", headers=auth(token_parent))
    check("…nor delete one", r.status_code == 403, f"{r.status_code} {r.text[:160]}")

    section("3. real pictures are accepted, whatever the filename claims")

    first = image_bytes("JPEG", (900, 600), (30, 120, 200))
    r = client.post(
        "/api/auth/onboarding", json={**STUDENT, "display_name": "Photo Owner"}
    )
    check("a third student onboards for the uploads", r.status_code == 200, r.text[:200])
    token_c = r.json()["token"]
    id_c = r.json()["user"]["id"]

    r = client.post(
        "/api/profile/photo",
        headers=auth(token_c),
        # The name and media type are deliberately wrong: the bytes are a JPEG.
        files=photo_file("holiday-notes.txt", first, "text/plain"),
    )
    check("a JPEG named .txt is accepted on its contents", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    profile = r.json() if r.status_code == 200 else {}
    url_1 = profile.get("profile_photo_url") or ""
    check("the answer is the profile with a photo address", url_1.startswith("/api/profile/photo?v="), url_1)
    check(
        "…and the address carries no account id a caller could change",
        f"/{id_c}" not in url_1 and "user" not in url_1,
        url_1,
    )
    check("the answer has no image bytes or base64 in it", "image" not in profile and "data:" not in str(profile), str(profile)[:160])

    r = client.get("/api/profile/photo", headers=auth(token_c))
    check("the photo reads back", r.status_code == 200, f"{r.status_code} {r.text[:160]}")
    saved_1 = r.content
    check("as a JPEG", r.headers.get("content-type") == "image/jpeg", r.headers.get("content-type"))
    check("with sniffing switched off", r.headers.get("x-content-type-options") == "nosniff", r.headers)
    check("and kept private to this browser", "private" in (r.headers.get("cache-control") or ""), r.headers.get("cache-control"))
    check("shown inline rather than downloaded to the filesystem", "inline" in (r.headers.get("content-disposition") or ""), r.headers.get("content-disposition"))

    with Image.open(BytesIO(saved_1)) as stored:
        check(f"what is stored is a {OUTPUT_EDGE} square", stored.size == (OUTPUT_EDGE, OUTPUT_EDGE), stored.size)
        check("…in RGB, not a palette or alpha image", stored.mode == "RGB", stored.mode)
        check("…and it is a new JPEG, not the uploaded file", stored.format == "JPEG" and saved_1 != first, stored.format)
        centre = stored.getpixel((OUTPUT_EDGE // 2, OUTPUT_EDGE // 2))
    check("the centre keeps the picture's colour", all(abs(actual - wanted) < 12 for actual, wanted in zip(centre, (30, 120, 200))), centre)

    with SessionLocal() as db:
        row = db.get(ProfilePhoto, id_c)
        check("the bytes live in the database row, not a path on disk", row is not None and row.image == saved_1, row and len(row.image))
        check("…with the stored size recorded", row is not None and row.byte_size == len(saved_1), row and row.byte_size)

    section("4. a second account cannot read, replace or delete the first one's photo")

    r = client.get("/api/profile/photo", headers=auth(token_b))
    check("the second account has its own (absent) photo", r.status_code == 404, f"{r.status_code} {r.text[:160]}")
    check("…and received none of the first account's bytes", r.content != saved_1)

    r = client.get("/api/profile/photo", headers=auth(token_b), params={"user_id": id_c})
    check("naming the owner in the query does not open their photo", r.status_code == 404, f"{r.status_code} {r.text[:160]}")
    check("…even though the id was accepted as a harmless extra", r.content != saved_1)

    r = client.post(
        "/api/profile/photo", headers=auth(token_b), params={"user_id": id_c},
        files=photo_file("mine.jpg", image_bytes("JPEG", (400, 400), (10, 200, 10))),
    )
    check("uploading while naming the other account saves it to the caller", r.status_code == 200, r.text[:200])
    saved_b = client.get("/api/profile/photo", headers=auth(token_b)).content
    check("the owner's picture is unchanged by that upload", client.get("/api/profile/photo", headers=auth(token_c)).content == saved_1)
    check("…and the second account really got its own", saved_b and saved_b != saved_1)

    r = client.delete("/api/profile/photo?user_id=" + str(id_c), headers=auth(token_b))
    check("deleting while naming the other account removes only the caller's", r.status_code == 200, r.text[:200])
    check("the caller now has no photo", client.get("/api/profile/photo", headers=auth(token_b)).status_code == 404)
    check("…and the owner's photo survived the delete", client.get("/api/profile/photo", headers=auth(token_c)).content == saved_1)

    section("5. what is refused, and what a refusal leaves behind")

    refusals = [
        ("an HTML file renamed as a photo", photo_file("photo.jpg", b"<html><script>alert(1)</script></html>"), 415),
        ("an SVG, which is scriptable XML", photo_file("mark.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml"), 415),
        ("a GIF, which this app does not keep", photo_file("wave.gif", image_bytes("GIF", (128, 128))), 415),
        ("a file with no bytes at all", photo_file("empty.jpg", b""), 415),
        ("a damaged PNG", photo_file("broken.png", image_bytes("PNG", (700, 700))[:300], "image/png"), 422),
        ("a picture below 64 px", photo_file("tiny.png", image_bytes("PNG", (32, 32)), "image/png"), 422),
        ("a picture wider than 8192 px", photo_file("wide.png", image_bytes("PNG", (9000, 2)), "image/png"), 422),
        ("a file over five megabytes", photo_file("huge.jpg", b"\0" * (MAX_UPLOAD_BYTES + 1)), 413),
    ]
    for label, files, expected in refusals:
        r = client.post("/api/profile/photo", headers=auth(token_c), files=files)
        check(f"{label} is refused with {expected}", r.status_code == expected, f"{r.status_code} {r.text[:160]}")

    check(
        "after every refusal the saved photo is byte-for-byte the one that was there",
        client.get("/api/profile/photo", headers=auth(token_c)).content == saved_1,
    )
    check(
        "…and the profile still points at it",
        client.get("/api/auth/me", headers=auth(token_c)).json()["profile"]["profile_photo_url"] == url_1,
    )

    section("6. EXIF is stripped and transparency becomes white, not black")

    photo_with_exif = BytesIO()
    exif = Image.Exif()
    exif[0x013B] = "Photo Test Photographer"  # Artist
    Image.new("RGB", (500, 400), (80, 160, 90)).save(photo_with_exif, format="JPEG", exif=exif)
    r = client.post("/api/profile/photo", headers=auth(token_c), files=photo_file("phone.jpg", photo_with_exif.getvalue()))
    check("a photo carrying EXIF is accepted", r.status_code == 200, r.text[:200])
    saved_exif = client.get("/api/profile/photo", headers=auth(token_c)).content
    with Image.open(BytesIO(saved_exif)) as stored:
        check("the stored file carries no EXIF block at all", len(stored.getexif()) == 0, dict(stored.getexif()))
        check("…so the photographer tag did not survive", 0x013B not in stored.getexif())

    transparent = BytesIO()
    Image.new("RGBA", (128, 128), (0, 0, 0, 0)).save(transparent, format="PNG")
    r = client.post("/api/profile/photo", headers=auth(token_c), files=photo_file("clear.png", transparent.getvalue(), "image/png"))
    check("a fully transparent PNG is accepted", r.status_code == 200, r.text[:200])
    with Image.open(BytesIO(client.get("/api/profile/photo", headers=auth(token_c)).content)) as stored:
        check("…and its transparency is flattened onto white", all(channel > 245 for channel in stored.getpixel((256, 256))), stored.getpixel((256, 256)))

    section("7. replacing keeps the old picture until the new one is stored")

    # Start from a known picture again so the comparison below is unambiguous.
    r = client.post("/api/profile/photo", headers=auth(token_c), files=photo_file("first.jpg", image_bytes("JPEG", (600, 600), (240, 30, 30))))
    check("a first picture is saved", r.status_code == 200, r.text[:200])
    url_before = r.json()["profile_photo_url"]
    before = client.get("/api/profile/photo", headers=auth(token_c)).content

    time.sleep(1.05)  # the cache-busting version is whole seconds
    r = client.post("/api/profile/photo", headers=auth(token_c), files=photo_file("second.jpg", image_bytes("JPEG", (600, 600), (30, 30, 240))))
    check("a replacement is accepted", r.status_code == 200, r.text[:200])
    url_after = r.json()["profile_photo_url"]
    after = client.get("/api/profile/photo", headers=auth(token_c)).content
    check("the picture actually changed", after != before)
    check("…and so did the address's version, so no cache serves the old face", url_after != url_before, f"{url_before} -> {url_after}")

    r = client.post("/api/profile/photo", headers=auth(token_c), files=photo_file("bad.jpg", b"not an image"))
    check("a refused replacement answers 415", r.status_code == 415, f"{r.status_code} {r.text[:160]}")
    check("…and the successful replacement is still the saved one", client.get("/api/profile/photo", headers=auth(token_c)).content == after)
    check("…with its address unchanged", client.get("/api/auth/me", headers=auth(token_c)).json()["profile"]["profile_photo_url"] == url_after)

    section("8. a storage failure leaves the working picture in place")

    class FailingCommit:
        def __init__(self, real):
            self._real = real

        def __getattr__(self, name):
            return getattr(self._real, name)

        def commit(self):
            raise RuntimeError("simulated storage failure")

    def failing_db():
        db = SessionLocal()
        try:
            yield FailingCommit(db)
        finally:
            db.close()

    app.dependency_overrides[get_db] = failing_db
    try:
        r = tolerant.post(
            "/api/profile/photo", headers=auth(token_c),
            files=photo_file("never-saved.jpg", image_bytes("JPEG", (300, 300), (1, 2, 3))),
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
    check("a failed write answers 5xx rather than claiming success", 500 <= r.status_code < 600, f"{r.status_code} {r.text[:160]}")
    check("…and the old picture is still readable byte-for-byte", client.get("/api/profile/photo", headers=auth(token_c)).content == after)

    section("9. the picture survives a reload and a fresh browser")

    reloaded = client.get("/api/auth/me", headers=auth(token_c))
    check("after a reload the session still names the photo", reloaded.status_code == 200 and reloaded.json()["profile"]["profile_photo_url"] == url_after, reloaded.text[:200])

    fresh = TestClient(app)  # a different browser, no cookie from the uploads
    r = fresh.get("/api/profile/photo", headers=auth(token_c))
    check("…and the photo is there when the same session arrives from another browser", r.status_code == 200 and r.content == after, f"{r.status_code} {len(r.content)}")
    check("…with the same address on the profile", r.status_code == 200 and fresh.get("/api/auth/me", headers=auth(token_c)).json()["profile"]["profile_photo_url"] == url_after)

    section("10. removal, a second removal, and account erasure")

    r = client.delete("/api/profile/photo", headers=auth(token_c))
    check("removing answers with the profile", r.status_code == 200 and r.json().get("profile_photo_url") is None, r.text[:200])
    check("the bytes are gone", client.get("/api/profile/photo", headers=auth(token_c)).status_code == 404)
    with SessionLocal() as db:
        check("…and so is the row", db.get(ProfilePhoto, id_c) is None)
    r = client.delete("/api/profile/photo", headers=auth(token_c))
    check("a second removal is not an error", r.status_code == 200 and r.json().get("profile_photo_url") is None, r.text[:200])

    # Erasing an account must take its picture with it, not leave a face behind in a
    # table that the other delete paths do not walk.
    r = client.post("/api/profile/photo", headers=auth(token_a), files=photo_file("first-account.jpg", image_bytes("JPEG", (400, 400))))
    check("the first account saves a picture to erase", r.status_code == 200, r.text[:200])
    r = client.delete("/api/users/me", headers=auth(token_a))
    check("an account with a photo can be erased", r.status_code == 200, r.text[:200])
    with SessionLocal() as db:
        remaining = db.execute(
            select(ProfilePhoto).where(ProfilePhoto.user_id == id_a)
        ).scalars().all()
    check("erasing the account removed its photo too", remaining == [], remaining)
    check("…so the picture cannot be read afterwards", client.get("/api/profile/photo", headers=auth(token_a)).status_code == 401)

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFAILED CHECKS:")
    for name in FAIL:
        print("  -", name)

# The throwaway database is left behind only on failure, where it is useful evidence.
# Windows keeps the file open until every client and the engine have let go of it.
for browser in (client, anon, tolerant, fresh):
    browser.close()
engine.dispose()
if not FAIL and DB_PATH.exists():
    DB_PATH.unlink()
sys.exit(1 if FAIL else 0)
