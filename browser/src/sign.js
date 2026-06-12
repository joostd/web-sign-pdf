import { PDFDocument } from 'pdf-lib';
import { pemToDer } from './pem.js';
import { importSigningKey } from './key.js';
import { addSignaturePlaceholder } from './placeholder.js';
import { prepareForSigning, embedSignature } from './byteRange.js';
import { buildDetachedCms } from './cms.js';

/**
 * Sign `pdfBytes` with a PEM-encoded, unencrypted PKCS#8 private key and a
 * PEM-encoded X.509 certificate.
 *
 * The private key is imported into WebCrypto as a non-extractable signing
 * key; the RSA/ECDSA signature operation itself runs through
 * `crypto.subtle.sign`.
 *
 * @param {object} options
 * @param {Uint8Array} options.pdfBytes
 * @param {string} options.privateKeyPem PKCS#8 PEM, e.g. `openssl pkcs8 -topk8 -nocrypt ...`
 * @param {string} options.certificatePem
 * @param {string[]} [options.chainPems] additional PEM certificates for the chain
 * @param {object} [options.metadata] signature dictionary fields (reason, location, etc.)
 * @returns {Promise<Uint8Array>} the signed PDF
 */
export async function signPdf({
  pdfBytes,
  privateKeyPem,
  certificatePem,
  chainPems = [],
  metadata = {},
}) {
  const cryptoKey = await importSigningKey(pemToDer(privateKeyPem));

  const pdfDoc = await PDFDocument.load(pdfBytes);
  addSignaturePlaceholder(pdfDoc, metadata);
  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  const { signedData, byteRange, placeholderLength } = prepareForSigning(pdfWithPlaceholder);

  const signatureDer = await buildDetachedCms({
    data: signedData,
    certificateDer: pemToDer(certificatePem),
    chainDers: chainPems.map(pemToDer),
    cryptoKey,
    signingTime: metadata.signingTime,
  });

  return embedSignature(signedData, byteRange, placeholderLength, signatureDer);
}
