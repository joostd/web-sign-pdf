'use strict';

const forge = require('node-forge');
const { Signer } = require('@signpdf/utils');

function loadPrivateKey(pem, passphrase) {
  if (pem.includes('ENCRYPTED PRIVATE KEY')) {
    if (!passphrase) {
      throw new Error('Private key is encrypted; a passphrase is required');
    }
    const encryptedKeyInfo = forge.pki.encryptedPrivateKeyFromPem(pem);
    const keyInfo = forge.pki.decryptPrivateKeyInfo(encryptedKeyInfo, passphrase);
    if (!keyInfo) {
      throw new Error('Failed to decrypt private key (wrong passphrase?)');
    }
    return forge.pki.privateKeyFromAsn1(keyInfo);
  }
  if (pem.includes('RSA PRIVATE KEY') && pem.includes('ENCRYPTED')) {
    if (!passphrase) {
      throw new Error('Private key is encrypted; a passphrase is required');
    }
    return forge.pki.decryptRsaPrivateKey(pem, passphrase);
  }
  return forge.pki.privateKeyFromPem(pem);
}

/**
 * A @signpdf/signpdf Signer that builds a detached PKCS#7/CMS signature
 * (Adobe.PPKLite / adbe.pkcs7.detached) from a PEM-encoded private key and
 * X.509 certificate, mirroring the inputs of `SimpleSigner.load` in the
 * Python demo.
 */
class PemSigner extends Signer {
  constructor(privateKeyPem, certificatePem, { caChainPems = [], passphrase = null } = {}) {
    super();
    this.privateKey = loadPrivateKey(privateKeyPem.toString('utf8'), passphrase);
    this.certificate = forge.pki.certificateFromPem(certificatePem.toString('utf8'));
    this.caChain = caChainPems.map((pem) => forge.pki.certificateFromPem(pem.toString('utf8')));
  }

  async sign(pdfBuffer, signingTime = undefined) {
    if (!(pdfBuffer instanceof Buffer)) {
      throw new Error('PDF expected as Buffer.');
    }

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(pdfBuffer.toString('binary'));

    p7.addCertificate(this.certificate);
    for (const cert of this.caChain) {
      p7.addCertificate(cert);
    }

    p7.addSigner({
      key: this.privateKey,
      certificate: this.certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        {
          type: forge.pki.oids.signingTime,
          value: signingTime ?? new Date(),
        },
        {
          type: forge.pki.oids.messageDigest,
          // value is auto-populated at signing time
        },
      ],
    });

    p7.sign({ detached: true });
    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
  }
}

module.exports = { PemSigner };
