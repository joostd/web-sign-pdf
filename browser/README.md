# web-sign-pdf (browser)

A demo for digitally signing a PDF file entirely in the browser, built on
[pdf-lib](https://github.com/Hopding/pdf-lib) and
[pkijs](https://github.com/PeculiarVentures/PKI.js). The private key never
leaves the [WebCrypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
API: it is imported as a non-extractable key with `crypto.subtle.importKey`,
and the actual RSA/ECDSA signing operation runs through `crypto.subtle.sign`.

This is a browser port of the JavaScript demo at `../javascript`, producing
the same `Adobe.PPKLite` / `adbe.pkcs7.detached` CMS signature.

## Setup

```sh
npm install
```

## Running the demo

```sh
npm run serve
```

This builds `dist/bundle.js` with esbuild and serves the current directory
at <http://localhost:8000>. Open `index.html` in the browser, then pick:

- a PDF file to sign
- a private key (**unencrypted PKCS#8 PEM**, RSA or EC)
- an X.509 certificate (PEM)

and optionally fill in the reason, location, and signer name. Click "Sign
PDF" to download the signed file.

If you only change `src/main.js` or other source files (not `index.html`),
re-run `npm run build` to refresh `dist/bundle.js`, or use `npm run serve`
which rebuilds on each request.

### Private key format

The key must be an unencrypted PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`).
If you have a traditional/encrypted key, convert it with OpenSSL:

```sh
openssl pkcs8 -topk8 -nocrypt -in key.pem -out key-pkcs8.pem
```

## Trying it out

Generate a throwaway self-signed key/certificate with OpenSSL:

```sh
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
    -days 365 -nodes -subj "/CN=Test Signer"
openssl pkcs8 -topk8 -nocrypt -in key.pem -out key-pkcs8.pem
```

EC keys (P-256/P-384/P-521) work too:

```sh
openssl ecparam -name prime256v1 -genkey -noout -out eckey.pem
openssl pkcs8 -topk8 -nocrypt -in eckey.pem -out eckey-pkcs8.pem
openssl req -x509 -new -key eckey.pem -out eccert.pem -days 365 -subj "/CN=Test Signer"
```

Any PDF can be used as the input file.

## Tests

```sh
npm test
```

The test signs a sample PDF with a throwaway self-signed certificate, then
verifies the embedded CMS/PKCS#7 signature with
[pkijs](https://github.com/PeculiarVentures/PKI.js) (message digest and
signature validity), entirely under Node's WebCrypto implementation.
