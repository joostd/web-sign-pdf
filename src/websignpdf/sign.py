"""Sign a PDF file with a private key and X.509 certificate.

Wraps pyHanko to add a digital signature field to an existing PDF, signed
with a PEM-encoded private key and certificate (plus an optional chain of
intermediate certificates).
"""

from __future__ import annotations

import argparse
import sys

from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import fields, signers


def sign_pdf(
    input_path: str,
    output_path: str,
    key_path: str,
    cert_path: str,
    chain_paths: list[str] | None = None,
    passphrase: bytes | None = None,
    field_name: str = "Signature1",
    reason: str | None = None,
    location: str | None = None,
    contact_info: str | None = None,
    signer_name: str | None = None,
) -> None:
    """Sign ``input_path`` and write the result to ``output_path``."""

    signer = signers.SimpleSigner.load(
        key_file=key_path,
        cert_file=cert_path,
        ca_chain_files=chain_paths,
        key_passphrase=passphrase,
    )
    if signer is None:
        raise ValueError(
            f"Could not load private key/certificate from {key_path!r} / {cert_path!r}"
        )

    signature_meta = signers.PdfSignatureMetadata(
        field_name=field_name,
        reason=reason,
        location=location,
        contact_info=contact_info,
        name=signer_name,
    )

    with open(input_path, "rb") as inf:
        writer = IncrementalPdfFileWriter(inf)
        out = signers.sign_pdf(
            writer,
            signature_meta,
            signer=signer,
            new_field_spec=fields.SigFieldSpec(sig_field_name=field_name),
        )

    with open(output_path, "wb") as outf:
        outf.write(out.getvalue())


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Sign a PDF file with a private key and certificate.")
    parser.add_argument("input", help="Path to the input PDF file")
    parser.add_argument("output", help="Path to write the signed PDF file")
    parser.add_argument("--key", required=True, help="Path to the PEM-encoded private key")
    parser.add_argument("--cert", required=True, help="Path to the PEM-encoded signing certificate")
    parser.add_argument(
        "--chain",
        nargs="*",
        default=None,
        metavar="CERT",
        help="Additional PEM-encoded certificates to include in the signature chain",
    )
    parser.add_argument("--passphrase", default=None, help="Passphrase for the private key, if encrypted")
    parser.add_argument("--field-name", default="Signature1", help="Name of the signature field to create")
    parser.add_argument("--reason", default=None, help="Reason for signing, shown to the viewer")
    parser.add_argument("--location", default=None, help="Location of signing, shown to the viewer")
    parser.add_argument("--contact-info", default=None, help="Signer's contact information")
    parser.add_argument("--signer-name", default=None, help="Display name of the signer")
    args = parser.parse_args(argv)

    passphrase = args.passphrase.encode("utf-8") if args.passphrase else None

    sign_pdf(
        input_path=args.input,
        output_path=args.output,
        key_path=args.key,
        cert_path=args.cert,
        chain_paths=args.chain,
        passphrase=passphrase,
        field_name=args.field_name,
        reason=args.reason,
        location=args.location,
        contact_info=args.contact_info,
        signer_name=args.signer_name,
    )
    print(f"Signed PDF written to {args.output}")


if __name__ == "__main__":
    sys.exit(main())
