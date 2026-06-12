import { fromBER } from 'asn1js';

const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1';
const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1';

const EC_CURVES_BY_OID = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
};

/**
 * Import an unencrypted PKCS#8 private key (RSA or EC) into WebCrypto as a
 * non-extractable signing key, ready for use with `crypto.subtle.sign`.
 *
 * The key's algorithm is detected from the PKCS#8 `AlgorithmIdentifier` so
 * the correct WebCrypto import parameters (RSASSA-PKCS1-v1_5 vs ECDSA +
 * curve) can be chosen.
 */
export async function importSigningKey(pkcs8Der, hashAlgorithm = 'SHA-256') {
  const { result: privateKeyInfo } = fromBER(pkcs8Der.buffer.slice(
    pkcs8Der.byteOffset,
    pkcs8Der.byteOffset + pkcs8Der.byteLength,
  ));
  const algorithmIdentifier = privateKeyInfo.valueBlock.value[1];
  const algorithmOid = algorithmIdentifier.valueBlock.value[0].valueBlock.toString();

  if (algorithmOid === OID_RSA_ENCRYPTION) {
    return crypto.subtle.importKey(
      'pkcs8',
      pkcs8Der,
      { name: 'RSASSA-PKCS1-v1_5', hash: hashAlgorithm },
      false,
      ['sign'],
    );
  }

  if (algorithmOid === OID_EC_PUBLIC_KEY) {
    const curveOid = algorithmIdentifier.valueBlock.value[1].valueBlock.toString();
    const namedCurve = EC_CURVES_BY_OID[curveOid];
    if (!namedCurve) {
      throw new Error(`Unsupported EC curve OID: ${curveOid}`);
    }
    return crypto.subtle.importKey(
      'pkcs8',
      pkcs8Der,
      { name: 'ECDSA', namedCurve },
      false,
      ['sign'],
    );
  }

  throw new Error(`Unsupported private key algorithm OID: ${algorithmOid}`);
}
