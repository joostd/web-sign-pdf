import assert from 'node:assert';
import test from 'node:test';

import forge from 'node-forge';
import * as pkijs from 'pkijs';
import { extractSignature } from '@signpdf/utils';

import { signPdf } from '../src/sign.js';
import { makeSamplePdf } from '../src/samplePdf.js';
import { ensureCryptoEngine } from '../src/cms.js';

/** Generate a throwaway self-signed RSA certificate + PKCS#8 key pair for testing. */
function selfSignedKeyPair({ commonName = 'Test Signer' } = {}) {
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(cert.validity.notBefore);
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: 'commonName', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certificatePem = forge.pki.certificateToPem(cert);
  const privateKeyPem = forge.pki.privateKeyInfoToPem(
    forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey)),
  );
  return { privateKeyPem, certificatePem };
}

async function verifySignedPdf(signedPdf) {
  ensureCryptoEngine();

  const { signature, signedData } = extractSignature(Buffer.from(signedPdf));
  const cmsContent = pkijs.ContentInfo.fromBER(Buffer.from(signature, 'binary'));
  const cmsSigned = new pkijs.SignedData({ schema: cmsContent.content });
  return cmsSigned.verify({ signer: 0, data: signedData, extendedMode: true });
}

test('signPdf produces a cryptographically valid signature with an RSA key', async () => {
  const { privateKeyPem, certificatePem } = selfSignedKeyPair();
  const pdfBytes = await makeSamplePdf();

  const signedPdf = await signPdf({
    pdfBytes,
    privateKeyPem,
    certificatePem,
    metadata: { reason: 'Testing', location: 'Test Suite', name: 'Test Signer' },
  });

  const result = await verifySignedPdf(signedPdf);
  assert.strictEqual(result.signatureVerified, true);
});
