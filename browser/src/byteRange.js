import { BYTE_RANGE_PLACEHOLDER } from './placeholder.js';

const PLACEHOLDER_TOKEN = `/${BYTE_RANGE_PLACEHOLDER}`;

const latin1Decoder = new TextDecoder('latin1');

function toLatin1String(bytes) {
  return latin1Decoder.decode(bytes);
}

function fromLatin1String(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Strip a single trailing CRLF/LF/CR, as required before `%%EOF`. */
function removeTrailingNewLine(bytes) {
  let end = bytes.length;
  if (bytes[end - 1] === 0x0a) end -= 1; // \n
  if (bytes[end - 1] === 0x0d) end -= 1; // \r
  return bytes.slice(0, end);
}

/**
 * Find the `/ByteRange [...]` placeholder written by `addSignaturePlaceholder`.
 *
 * pdf-lib's serializer is free to add whitespace around the brackets (it
 * emits `/ByteRange [ 0 /** ** ** ** /** ** ** ** /** ** ** ** ]`), so this
 * searches for the `/ByteRange` keyword and the following `[`/`]` pair
 * rather than matching an exact literal string.
 */
function findByteRangePlaceholder(pdfString) {
  const byteRangePos = pdfString.indexOf('/ByteRange');
  if (byteRangePos === -1) {
    throw new Error('Failed to locate the /ByteRange placeholder.');
  }

  const rangeStart = pdfString.indexOf('[', byteRangePos);
  const rangeEnd = pdfString.indexOf(']', rangeStart);
  if (rangeStart === -1 || rangeEnd === -1) {
    throw new Error('Failed to locate the /ByteRange placeholder.');
  }

  const byteRangeEnd = rangeEnd + 1;
  const byteRangeString = pdfString.slice(byteRangePos, byteRangeEnd);

  const tokens = byteRangeString
    .slice(byteRangeString.indexOf('[') + 1, byteRangeString.lastIndexOf(']'))
    .split(' ')
    .filter((token) => token.length > 0);

  if (
    tokens.length !== 4
    || tokens[0] !== '0'
    || tokens[1] !== PLACEHOLDER_TOKEN
    || tokens[2] !== PLACEHOLDER_TOKEN
    || tokens[3] !== PLACEHOLDER_TOKEN
  ) {
    throw new Error('Failed to locate the /ByteRange placeholder.');
  }

  return { byteRangeString, byteRangePos, byteRangeEnd };
}

/**
 * Locate the `/ByteRange [** ** ** **]` and `/Contents <00...00>` placeholder
 * left by `addSignaturePlaceholder`, fill in the real `/ByteRange`, and
 * return the PDF bytes with the `/Contents` placeholder removed (i.e. the
 * bytes that the detached CMS signature must cover) along with everything
 * needed to embed the finished signature with `embedSignature`.
 *
 * Ported from `@signpdf/signpdf`'s byte-range handling to operate on
 * `Uint8Array` instead of Node `Buffer`.
 */
export function prepareForSigning(pdfBytes) {
  const pdf = removeTrailingNewLine(pdfBytes);
  const pdfString = toLatin1String(pdf);

  const { byteRangeString, byteRangePos, byteRangeEnd } = findByteRangePlaceholder(pdfString);

  const contentsTagPos = pdfString.indexOf('/Contents ', byteRangeEnd);
  const placeholderPos = pdfString.indexOf('<', contentsTagPos);
  const placeholderEnd = pdfString.indexOf('>', placeholderPos);
  const placeholderLengthWithBrackets = placeholderEnd + 1 - placeholderPos;
  const placeholderLength = placeholderLengthWithBrackets - 2;

  const byteRange = [0, 0, 0, 0];
  byteRange[1] = placeholderPos;
  byteRange[2] = byteRange[1] + placeholderLengthWithBrackets;
  byteRange[3] = pdf.length - byteRange[2];

  let actualByteRange = `/ByteRange [${byteRange.join(' ')}]`;
  actualByteRange += ' '.repeat(byteRangeString.length - actualByteRange.length);

  let out = concatBytes([
    pdf.slice(0, byteRangePos),
    fromLatin1String(actualByteRange),
    pdf.slice(byteRangeEnd),
  ]);

  // Remove the /Contents placeholder; what remains is exactly what the
  // detached signature will cover.
  out = concatBytes([out.slice(0, byteRange[1]), out.slice(byteRange[2], byteRange[2] + byteRange[3])]);

  return { signedData: out, byteRange, placeholderLength };
}

/** Hex-encode `signatureDer` and write it into the `/Contents` placeholder. */
export function embedSignature(signedData, byteRange, placeholderLength, signatureDer) {
  if (signatureDer.length * 2 > placeholderLength) {
    throw new Error(`Signature exceeds placeholder length: ${signatureDer.length * 2} > ${placeholderLength}`);
  }

  let hex = Array.from(signatureDer, (b) => b.toString(16).padStart(2, '0')).join('');
  hex += '0'.repeat(placeholderLength - hex.length);

  return concatBytes([
    signedData.slice(0, byteRange[1]),
    fromLatin1String(`<${hex}>`),
    signedData.slice(byteRange[1]),
  ]);
}
