# web-sign-pdf (JavaScript)

A small demo for digitally signing a PDF file with a private key and X.509
certificate, built on [pdf-lib](https://github.com/Hopding/pdf-lib),
[@signpdf/signpdf](https://github.com/vbuch/node-signpdf) and
[node-forge](https://github.com/digitalbazaar/forge). This is a JavaScript
port of the Python demo at the repository root, with the same CLI shape.

## Setup

```sh
npm install
```

## Usage

`sign-pdf` adds a signature field to an existing PDF and signs it with a
PEM-encoded private key and certificate:

```sh
node src/sign.js input.pdf signed.pdf \
    --key key.pem --cert cert.pem \
    --reason "Approved" --location "Amsterdam" --signer-name "Jane Doe"
```

Optional flags:

- `--chain CERT...` -- additional PEM certificates to include in the
  signature's chain (e.g. an intermediate CA)
- `--passphrase PASSPHRASE` -- passphrase for an encrypted (PKCS#8) private key
- `--contact-info INFO` -- signer's contact information

## Trying it out

Generate a throwaway self-signed key/certificate with OpenSSL:

```sh
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
    -days 365 -nodes -subj "/CN=Test Signer"
```

Generate a minimal sample PDF to sign:

```sh
node src/samplePdf.js sample.pdf
```

Then sign it:

```sh
node src/sign.js sample.pdf signed.pdf --key key.pem --cert cert.pem
```

## Tests

```sh
npm test
```

The test signs a sample PDF with a throwaway self-signed certificate, then
verifies the embedded CMS/PKCS#7 signature with [pkijs](https://github.com/PeculiarVentures/PKI.js)
(message digest and signature validity).
