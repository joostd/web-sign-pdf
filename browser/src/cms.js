import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';

const OID_DATA = '1.2.840.113549.1.7.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';

let engineConfigured = false;

/** Point pkijs at the platform's WebCrypto implementation (idempotent). */
export function ensureCryptoEngine() {
  if (!engineConfigured) {
    pkijs.setEngine('webcrypto', new pkijs.CryptoEngine({ name: 'webcrypto', crypto }));
    engineConfigured = true;
  }
}

/**
 * Build a detached, Adobe.PPKLite-compatible CMS/PKCS#7 SignedData blob
 * (`adbe.pkcs7.detached`) over `data`, signed with `cryptoKey` -- a
 * `CryptoKey` obtained via `importSigningKey` (the actual RSA/ECDSA
 * operation is performed by `crypto.subtle.sign`, never exposing raw key
 * material to this code).
 */
export async function buildDetachedCms({
  data, certificateDer, chainDers = [], cryptoKey, hashAlgorithm = 'SHA-256', signingTime = new Date(),
}) {
  ensureCryptoEngine();

  const certificate = pkijs.Certificate.fromBER(certificateDer);
  const chainCertificates = chainDers.map((der) => pkijs.Certificate.fromBER(der));
  const digest = await crypto.subtle.digest(hashAlgorithm, data);

  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID_DATA }),
    certificates: [certificate, ...chainCertificates],
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: certificate.issuer,
          serialNumber: certificate.serialNumber,
        }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({
          type: 0,
          attributes: [
            new pkijs.Attribute({
              type: OID_CONTENT_TYPE,
              values: [new asn1js.ObjectIdentifier({ value: OID_DATA })],
            }),
            new pkijs.Attribute({
              type: OID_SIGNING_TIME,
              values: [new asn1js.UTCTime({ valueDate: signingTime })],
            }),
            new pkijs.Attribute({
              type: OID_MESSAGE_DIGEST,
              values: [new asn1js.OctetString({ valueHex: digest })],
            }),
          ],
        }),
      }),
    ],
  });

  // The actual signature is computed by crypto.subtle.sign via cryptoKey.
  await signedData.sign(cryptoKey, 0, hashAlgorithm, data);

  const contentInfo = new pkijs.ContentInfo({
    contentType: OID_SIGNED_DATA,
    content: signedData.toSchema(true),
  });
  return new Uint8Array(contentInfo.toSchema().toBER(false));
}
