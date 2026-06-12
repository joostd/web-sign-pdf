'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { webcrypto } = require('node:crypto');

const forge = require('node-forge');
const pkijs = require('pkijs');
const { extractSignature } = require('@signpdf/utils');
const { PDFDocument } = require('pdf-lib');

const { signPdf } = require('../src/sign');
const { makePdf } = require('../src/samplePdf');

function writeSelfSignedCert(dir) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(cert.validity.notBefore);
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{ name: 'commonName', value: 'Test Signer' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey));
  fs.writeFileSync(certPath, forge.pki.certificateToPem(cert));
  return { keyPath, certPath };
}

test('signPdf produces a cryptographically valid signature', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'websignpdf-'));
  const { keyPath, certPath } = writeSelfSignedCert(dir);

  const inputPath = path.join(dir, 'input.pdf');
  const outputPath = path.join(dir, 'signed.pdf');
  fs.writeFileSync(inputPath, await makePdf());

  await signPdf({
    inputPath,
    outputPath,
    keyPath,
    certPath,
    reason: 'Testing',
    location: 'Test Suite',
    signerName: 'Test Signer',
  });

  const signedPdf = fs.readFileSync(outputPath);

  // The output is still a well-formed PDF.
  await PDFDocument.load(signedPdf);

  // Verify the embedded CMS/PKCS#7 signature cryptographically: the
  // messageDigest attribute must match the signed byte ranges, and the
  // signature over the signed attributes must verify against the
  // certificate's public key.
  pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto }));

  const { signature, signedData } = extractSignature(signedPdf);
  const cmsContent = pkijs.ContentInfo.fromBER(Buffer.from(signature, 'binary'));
  const cmsSigned = new pkijs.SignedData({ schema: cmsContent.content });

  const result = await cmsSigned.verify({ signer: 0, data: signedData, extendedMode: true });

  assert.strictEqual(result.signatureVerified, true);
});
