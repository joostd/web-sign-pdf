import {
  PDFArray, PDFDict, PDFHexString, PDFInvalidObject, PDFName, PDFNumber, PDFString,
} from 'pdf-lib';

export const DEFAULT_SIGNATURE_LENGTH = 8192;
export const BYTE_RANGE_PLACEHOLDER = '**********';
const SUBFILTER_ADOBE_PKCS7_DETACHED = 'adbe.pkcs7.detached';
const ANNOTATION_FLAG_PRINT = 4;
const SIG_FLAG_SIGNATURES_EXIST = 1;
const SIG_FLAG_APPEND_ONLY = 2;

/**
 * Add an empty signature field + widget to `pdfDoc`, with a `/ByteRange`
 * placeholder and a zero-filled `/Contents` hex string of
 * `signatureLength` bytes to be filled in later by `embedSignature`.
 *
 * Ported from `@signpdf/placeholder-pdf-lib`'s `pdflibAddPlaceholder` to
 * avoid a Node `Buffer`-dependent dependency in the browser bundle.
 */
export function addSignaturePlaceholder(pdfDoc, {
  fieldName = 'Signature1',
  reason = '',
  contactInfo = '',
  name = '',
  location = '',
  signingTime = new Date(),
  signatureLength = DEFAULT_SIGNATURE_LENGTH,
} = {}) {
  const { context } = pdfDoc;
  const page = pdfDoc.getPages()[0];

  const byteRange = PDFArray.withContext(context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));

  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(signatureLength));

  const signatureDict = context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of(reason),
    M: PDFString.fromDate(signingTime),
    ContactInfo: PDFString.of(contactInfo),
    Name: PDFString.of(name),
    Location: PDFString.of(location),
    Prop_Build: { Filter: { Name: 'Adobe.PPKLite' } },
  });
  const signatureBuffer = new Uint8Array(signatureDict.sizeInBytes());
  signatureDict.copyBytesInto(signatureBuffer, 0);
  const signatureDictRef = context.register(PDFInvalidObject.of(signatureBuffer));

  const widgetRect = [0, 0, 0, 0];
  const rect = PDFArray.withContext(context);
  widgetRect.forEach((c) => rect.push(PDFNumber.of(c)));
  const apStream = context.formXObject([], { BBox: widgetRect, Resources: {} });

  const widgetDict = context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: rect,
    V: signatureDictRef,
    T: PDFString.of(fieldName),
    F: ANNOTATION_FLAG_PRINT,
    P: page.ref,
    AP: { N: context.register(apStream) },
  });
  const widgetDictRef = context.register(widgetDict);

  let annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annotations === undefined) {
    annotations = context.obj([]);
  }
  annotations.push(widgetDictRef);
  page.node.set(PDFName.of('Annots'), annotations);

  let acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (acroForm === undefined) {
    acroForm = context.obj({ Fields: [] });
    pdfDoc.catalog.set(PDFName.of('AcroForm'), context.register(acroForm));
  }

  const existingFlags = acroForm.has(PDFName.of('SigFlags'))
    ? acroForm.get(PDFName.of('SigFlags')).asNumber()
    : 0;
  acroForm.set(
    PDFName.of('SigFlags'),
    PDFNumber.of(existingFlags | SIG_FLAG_SIGNATURES_EXIST | SIG_FLAG_APPEND_ONLY),
  );

  let fields = acroForm.get(PDFName.of('Fields'));
  if (!(fields instanceof PDFArray)) {
    fields = context.obj([]);
    acroForm.set(PDFName.of('Fields'), fields);
  }
  fields.push(widgetDictRef);
}
