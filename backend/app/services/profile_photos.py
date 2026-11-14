"""Turning whatever a browser uploads into the one photo this site will keep.

A profile photo is the one place an account takes a file from outside and stores its
bytes. That makes this module the boundary, and the rules below are what the boundary
enforces rather than what a screen promises:

* the file is decoded, not sniffed. A filename ending in `.jpg`, a browser claiming
  `image/jpeg` and a file whose bytes are a JPEG are three different claims, and only
  the third one is checked;
* only JPEG, PNG and WebP decode. An SVG is XML that can carry script, an HTML file is
  markup, and neither is an image this app has any reason to store;
* the pixel count is bounded before the image is decoded, so a small file that expands
  into an enormous bitmap is refused instead of exhausting the worker;
* what is stored is a new square JPEG of 512 px, drawn from the decoded pixels. That
  also drops the EXIF block, including the GPS position a phone writes into a photo,
  because nothing here copies the original metadata forward.

The bytes themselves live in `profile_photos`, the same way a printed report lives in
`report_pdfs`: the deployed backend has no disk that outlives a request.
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from ..models import ProfilePhoto

# Five megabytes is the ceiling a family on a phone plan can upload without waiting,
# and after normalisation the stored picture is roughly one hundredth of it.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# A 25-megapixel limit covers every phone camera this app is likely to see and still
# bounds the decode: the numbers are read from the header before any pixels are.
MAX_PIXELS = 25_000_000
MAX_EDGE = 8192
MIN_EDGE = 64
# The avatar is drawn at 80–96 px beside a name, so 512 keeps it sharp on a retina
# screen and on a printed report without storing a camera-sized original.
OUTPUT_EDGE = 512
OUTPUT_QUALITY = 88
ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
OUTPUT_CONTENT_TYPE = "image/jpeg"

UNSUPPORTED_MESSAGE = (
    "That file is not a photo this site can use. Choose a JPEG, PNG or WebP image."
)
TOO_LARGE_MESSAGE = "That photo is larger than 5 MB. Choose a smaller file."
TOO_MANY_PIXELS_MESSAGE = (
    "That photo is too large in pixels. Choose an image under 8000 pixels on each side."
)
TOO_SMALL_MESSAGE = (
    "That photo is too small to use. Choose one at least 64 × 64 pixels."
)
CORRUPT_MESSAGE = (
    "That image could not be read. It may be damaged — try another photo."
)


class PhotoRejected(Exception):
    """A refusal a screen can print. `status_code` is the HTTP answer that carries it."""

    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class NormalizedPhoto:
    image: bytes
    content_type: str
    width: int
    height: int

    @property
    def byte_size(self) -> int:
        return len(self.image)


def normalize(raw: bytes) -> NormalizedPhoto:
    """Decode, bound, centre-crop and re-encode one upload.

    Raises `PhotoRejected` for anything that is not a usable photo. Nothing is written
    to the database here; the caller only touches the stored row after this returns.
    """
    if len(raw) > MAX_UPLOAD_BYTES:
        raise PhotoRejected(TOO_LARGE_MESSAGE, 413)
    if not raw:
        raise PhotoRejected(UNSUPPORTED_MESSAGE, 415)

    try:
        # `Image.open` reads the header only. Format and dimensions are checked here,
        # which is what makes the pixel limit a limit on work rather than a comment.
        with Image.open(BytesIO(raw)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise PhotoRejected(UNSUPPORTED_MESSAGE, 415)
            width, height = probe.size
            if width < MIN_EDGE or height < MIN_EDGE:
                raise PhotoRejected(TOO_SMALL_MESSAGE)
            if width > MAX_EDGE or height > MAX_EDGE or width * height > MAX_PIXELS:
                raise PhotoRejected(TOO_MANY_PIXELS_MESSAGE)
            probe.verify()

        # `verify` leaves the object unusable, so the file is opened a second time and
        # fully decoded. A truncated or damaged file fails at `load`, which is the
        # check that a header alone cannot make.
        with Image.open(BytesIO(raw)) as source:
            source.load()
            # A phone photo is often stored sideways with an orientation tag. Applying
            # it now means the square crop is taken from the picture as a person sees
            # it, and the tag is not copied into the file this app writes.
            framed = ImageOps.exif_transpose(source)
            # Centre crop to a square, then resize. `fit` takes the larger of the two
            # ratios, so nothing is squashed and nothing outside the square is kept.
            square = ImageOps.fit(
                framed,
                (OUTPUT_EDGE, OUTPUT_EDGE),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            if square.mode in {"RGBA", "LA", "P"}:
                # A transparent PNG is flattened onto white rather than turned black,
                # which is what a naive conversion of the alpha channel would do.
                rgba = square.convert("RGBA")
                flattened = Image.new("RGB", rgba.size, (255, 255, 255))
                flattened.paste(rgba, mask=rgba.getchannel("A"))
                square = flattened
            else:
                square = square.convert("RGB")

            out = BytesIO()
            square.save(
                out,
                format="JPEG",
                quality=OUTPUT_QUALITY,
                optimize=True,
                progressive=True,
            )
    except PhotoRejected:
        raise
    except UnidentifiedImageError:
        # The header was not an image at all: an SVG, an HTML file, a document with a
        # picture's extension. That is the same answer as a GIF or a BMP, not "damaged".
        raise PhotoRejected(UNSUPPORTED_MESSAGE, 415) from None
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise PhotoRejected(CORRUPT_MESSAGE) from None

    return NormalizedPhoto(
        image=out.getvalue(),
        content_type=OUTPUT_CONTENT_TYPE,
        width=OUTPUT_EDGE,
        height=OUTPUT_EDGE,
    )


def photo_url(db: Session, user_id: int) -> str | None:
    """The address a screen may use for this account's photo, or None if it has none.

    The `v` is the row's update time, which is a cache-busting version rather than a
    secret: the route itself is still behind the session that owns the row.
    """
    row = db.get(ProfilePhoto, user_id)
    if row is None:
        return None
    return f"/api/profile/photo?v={int(row.updated_at.timestamp())}"
