# web-sign-pdf

A small demo for digitally signing a PDF file with a private key and X.509
certificate, built on [pyHanko](https://github.com/MatthiasValvekens/pyHanko).

A JavaScript port with the same functionality lives in
[`javascript/`](javascript/), and a browser version where the private key is
imported into WebCrypto lives in [`browser/`](browser/).

## Setup

```sh
python3 -m venv .venv && .venv/bin/pip install -e ".[test]"
```

## Usage

`sign-pdf` adds a signature field to an existing PDF and signs it with a
PEM-encoded private key and certificate:

```sh
.venv/bin/sign-pdf input.pdf signed.pdf \
    --key key.pem --cert cert.pem \
    --reason "Approved" --location "Amsterdam" --signer-name "Jane Doe"
```

Optional flags:

- `--chain CERT [CERT ...]` -- additional PEM certificates to include in the
  signature's chain (e.g. an intermediate CA)
- `--passphrase PASSPHRASE` -- passphrase for an encrypted private key
- `--field-name NAME` -- name of the signature field (default `Signature1`)
- `--contact-info INFO` -- signer's contact information

## Trying it out

Generate a throwaway self-signed key/certificate with OpenSSL:

```sh
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
    -days 365 -nodes -subj "/CN=Test Signer"
```

Generate a minimal sample PDF to sign:

```sh
.venv/bin/make-sample-pdf sample.pdf
```

Then sign it:

```sh
.venv/bin/sign-pdf sample.pdf signed.pdf --key key.pem --cert cert.pem
```

## Tests

```sh
.venv/bin/pytest
```
