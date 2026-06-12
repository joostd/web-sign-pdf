#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { parseArgs } = require('node:util');
const { PDFDocument } = require('pdf-lib');
const signpdf = require('@signpdf/signpdf').default;
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
const { PemSigner } = require('./pemSigner');

/**
 * Sign `inputPath` and write the result to `outputPath`.
 */
async function signPdf({
  inputPath,
  outputPath,
  keyPath,
  certPath,
  chainPaths = [],
  passphrase = null,
  reason = '',
  location = '',
  contactInfo = '',
  signerName = '',
}) {
  const privateKeyPem = fs.readFileSync(keyPath);
  const certificatePem = fs.readFileSync(certPath);
  const caChainPems = chainPaths.map((p) => fs.readFileSync(p));

  const signer = new PemSigner(privateKeyPem, certificatePem, { caChainPems, passphrase });

  const pdfDoc = await PDFDocument.load(fs.readFileSync(inputPath));
  pdflibAddPlaceholder({
    pdfDoc,
    reason,
    contactInfo,
    name: signerName,
    location,
  });
  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  const signedPdf = await signpdf.sign(Buffer.from(pdfWithPlaceholder), signer);
  fs.writeFileSync(outputPath, signedPdf);
}

function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      key: { type: 'string' },
      cert: { type: 'string' },
      chain: { type: 'string', multiple: true, default: [] },
      passphrase: { type: 'string' },
      reason: { type: 'string', default: '' },
      location: { type: 'string', default: '' },
      'contact-info': { type: 'string', default: '' },
      'signer-name': { type: 'string', default: '' },
    },
  });

  if (positionals.length !== 2 || !values.key || !values.cert) {
    console.error(
      'Usage: sign-pdf <input.pdf> <output.pdf> --key key.pem --cert cert.pem ' +
        '[--chain CERT...] [--passphrase PASSPHRASE] [--reason REASON] ' +
        '[--location LOCATION] [--contact-info INFO] [--signer-name NAME]',
    );
    process.exit(1);
  }

  const [inputPath, outputPath] = positionals;
  return {
    inputPath,
    outputPath,
    keyPath: values.key,
    certPath: values.cert,
    chainPaths: values.chain,
    passphrase: values.passphrase ?? null,
    reason: values.reason,
    location: values.location,
    contactInfo: values['contact-info'],
    signerName: values['signer-name'],
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  await signPdf(args);
  console.log(`Signed PDF written to ${args.outputPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { signPdf };
