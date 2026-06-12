"""Generate a minimal, valid one-page PDF for trying out the signing demo.

No third-party PDF library is needed: the document is small enough to
assemble by hand, computing the xref offsets as each object is written.
"""

from __future__ import annotations

import argparse
import sys

_OBJECTS = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]"
    b" /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
]

_CONTENT = b"BT /F1 18 Tf 20 100 Td (Hello, signed PDF!) Tj ET"


def make_pdf() -> bytes:
    objects = list(_OBJECTS)
    objects.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(_CONTENT), _CONTENT))

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n%s\nendobj\n" % (i, body)

    xref_offset = len(out)
    out += b"xref\n"
    out += b"0 %d\n" % (len(objects) + 1)
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n"
    out += b"<< /Size %d /Root 1 0 R >>\n" % (len(objects) + 1)
    out += b"startxref\n%d\n" % xref_offset
    out += b"%%EOF"
    return bytes(out)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", default="sample.pdf", help="Path to write the sample PDF")
    args = parser.parse_args(argv)

    with open(args.output, "wb") as f:
        f.write(make_pdf())
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    sys.exit(main())
