import datetime

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.general import load_cert_from_pemder
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko_certvalidator import ValidationContext

from websignpdf.sample_pdf import make_pdf
from websignpdf.sign import sign_pdf


def _write_self_signed_cert(tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Test Signer")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    key_path = tmp_path / "key.pem"
    cert_path = tmp_path / "cert.pem"
    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return key_path, cert_path


def test_sign_pdf_produces_valid_signature(tmp_path):
    key_path, cert_path = _write_self_signed_cert(tmp_path)

    input_path = tmp_path / "input.pdf"
    output_path = tmp_path / "signed.pdf"
    input_path.write_bytes(make_pdf())

    sign_pdf(
        input_path=str(input_path),
        output_path=str(output_path),
        key_path=str(key_path),
        cert_path=str(cert_path),
        reason="Testing",
        location="Test Suite",
        signer_name="Test Signer",
    )

    with open(output_path, "rb") as f:
        reader = PdfFileReader(f)
        sigs = reader.embedded_signatures
        assert len(sigs) == 1
        assert sigs[0].field_name == "Signature1"

        trust_root = load_cert_from_pemder(str(cert_path))
        vc = ValidationContext(trust_roots=[trust_root], allow_fetching=False)
        status = validate_pdf_signature(sigs[0], signer_validation_context=vc)

    assert status.intact
    assert status.valid
    assert status.trusted
