import { BinaryValidationResult, KhatianRecord, SurveyType } from '../types/land';

export const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // %PDF-
export const MIN_VALID_PDF_BYTES = 1024;

export interface ValidationContext {
  districtName: string;
  upazilaName: string;
  unionName: string;
  mouzaNameEn: string;
  mouzaNameBn: string;
  mouzaJlNo: string;
  surveyType: SurveyType;
  sourceUrl: string;
}

export function bytesToHex(bytes: Uint8Array, maxLen = 5): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, maxLen));
  return Array.from(slice)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export function hasPdfMagicSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  for (let i = 0; i < 5; i++) {
    if (bytes[i] !== PDF_MAGIC_BYTES[i]) {
      return false;
    }
  }
  return true;
}

export function hasPdfStructuralMarkers(bytes: Uint8Array): {
  valid: boolean;
  reason?: string;
} {
  if (!hasPdfMagicSignature(bytes)) {
    return { valid: false, reason: 'Missing %PDF- magic header' };
  }

  const headText = new TextDecoder('latin1').decode(
    bytes.subarray(0, Math.min(bytes.length, 32))
  );
  if (!/^%PDF-[12]\.\d/.test(headText)) {
    return {
      valid: false,
      reason: 'Invalid PDF version banner (expected %PDF-1.x or %PDF-2.x)',
    };
  }

  const fullText = new TextDecoder('latin1').decode(bytes);
  const hasObjects = /\b\d+\s+\d+\s+obj\b/.test(fullText) && /\bendobj\b/.test(fullText);
  if (!hasObjects) {
    return {
      valid: false,
      reason: 'Structurally invalid PDF: missing indirect object definitions (obj/endobj)',
    };
  }

  const hasXref = /\bxref\b/.test(fullText) || /\/Type\s*\/XRef\b/.test(fullText);
  if (!hasXref) {
    return {
      valid: false,
      reason: 'Structurally invalid PDF: missing cross-reference table or XRef stream',
    };
  }

  const tailSlice = bytes.subarray(Math.max(0, bytes.length - 2048));
  const tailText = new TextDecoder('latin1').decode(tailSlice);
  if (!/\bstartxref\b/.test(tailText) || !/%%EOF\b/.test(tailText)) {
    return {
      valid: false,
      reason: 'Structurally incomplete PDF: missing startxref or %%EOF trailer marker',
    };
  }

  return { valid: true };
}

export function isStructurallyValidPdf(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength > MIN_VALID_PDF_BYTES &&
    hasPdfMagicSignature(bytes) &&
    hasPdfStructuralMarkers(bytes).valid
  );
}

export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(new Uint8Array(buffer)).digest('hex');
}

export function extractStructuredRecordsFromText(
  text: string,
  ctx: ValidationContext
): KhatianRecord[] {
  const records: KhatianRecord[] = [];
  const trimmed = text.trim();
  const nowIso = new Date().toISOString();

  // 1. Parse JSON arrays/objects containing real khatian/dag rows
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.khatians)
        ? parsed.khatians
        : Array.isArray(parsed?.records)
        ? parsed.records
        : [];

      for (let idx = 0; idx < list.length; idx++) {
        const item = list[idx];
        if (!item || typeof item !== 'object') continue;
        const khatianNo = String(
          item.khatian_no ?? item.khatianNo ?? item.khatian ?? item.no ?? ''
        ).trim();
        const ownerName = String(
          item.owner_name ?? item.ownerName ?? item.owner ?? item.malik ?? ''
        ).trim();
        const dagNo = String(item.dag_no ?? item.dagNo ?? item.dag ?? '').trim();
        const totalLand = String(
          item.total_land ?? item.totalLand ?? item.land ?? item.acres ?? ''
        ).trim();

        if (khatianNo && (ownerName || dagNo)) {
          records.push({
            recordId: `${ctx.mouzaJlNo}_${ctx.surveyType}_${khatianNo}_${idx}`,
            districtName: ctx.districtName,
            upazilaName: ctx.upazilaName,
            unionName: ctx.unionName,
            mouzaNameEn: ctx.mouzaNameEn,
            mouzaNameBn: ctx.mouzaNameBn,
            mouzaJlNo: ctx.mouzaJlNo,
            surveyType: ctx.surveyType,
            khatianNo,
            ownerName: ownerName || 'N/A',
            dagNo: dagNo || 'N/A',
            totalLandAcres: totalLand || 'N/A',
            sourceUrl: ctx.sourceUrl,
            extractedAt: nowIso,
          });
        }
      }
      if (records.length > 0) return records;
    } catch {
      // Not valid JSON or schema mismatch
    }
  }

  // 2. Parse actual HTML table rows (`<tr>...<td>...</td>...</tr>`) from eporcha.tech HTML response
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const stripTags = (html: string) =>
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();

  let rowMatch: RegExpExecArray | null;
  let rowIndex = 0;
  while ((rowMatch = rowRegex.exec(trimmed)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length >= 3) {
      const [col0, col1, col2, col3] = cells;
      const isKhatianNumber = /^[\d\u09E6-\u09EF/-]+$/.test(col0.trim());
      if (isKhatianNumber && col0 && col1) {
        records.push({
          recordId: `${ctx.mouzaJlNo}_${ctx.surveyType}_${col0}_${rowIndex}`,
          districtName: ctx.districtName,
          upazilaName: ctx.upazilaName,
          unionName: ctx.unionName,
          mouzaNameEn: ctx.mouzaNameEn,
          mouzaNameBn: ctx.mouzaNameBn,
          mouzaJlNo: ctx.mouzaJlNo,
          surveyType: ctx.surveyType,
          khatianNo: col0,
          ownerName: col1,
          dagNo: col2 || 'N/A',
          totalLandAcres: col3 || 'N/A',
          sourceUrl: ctx.sourceUrl,
          extractedAt: nowIso,
        });
        rowIndex++;
      }
    }
  }

  return records;
}

export function inspectBinaryPayload(
  buffer: ArrayBuffer,
  ctx: ValidationContext
): BinaryValidationResult {
  const byteLength = buffer.byteLength;
  const bytes = new Uint8Array(buffer);
  const magicBytesHex = bytesToHex(bytes, 5);

  if (byteLength === 0) {
    return {
      isValidPdf: false,
      headerValid: false,
      structurallyValid: false,
      checksumRecorded: false,
      byteLength: 0,
      magicBytesHex: 'EMPTY',
      isHtmlPayload: false,
      isJsonPayload: false,
      extractedRecords: [],
      diagnosticReason: 'Rejected empty payload (0 bytes received).',
    };
  }

  const startsWithPdf = hasPdfMagicSignature(bytes);

  if (startsWithPdf && byteLength <= MIN_VALID_PDF_BYTES) {
    return {
      isValidPdf: false,
      headerValid: true,
      structurallyValid: false,
      checksumRecorded: false,
      byteLength,
      magicBytesHex,
      isHtmlPayload: false,
      isJsonPayload: false,
      extractedRecords: [],
      diagnosticReason: `Rejected truncated PDF: header starts with %PDF- (${magicBytesHex}) but size is only ${byteLength} bytes (must exceed ${MIN_VALID_PDF_BYTES} bytes).`,
    };
  }

  if (startsWithPdf) {
    const structuralCheck = hasPdfStructuralMarkers(bytes);
    if (structuralCheck.valid) {
      return {
        isValidPdf: true,
        headerValid: true,
        structurallyValid: true,
        checksumRecorded: false,
        byteLength,
        magicBytesHex,
        isHtmlPayload: false,
        isJsonPayload: false,
        extractedRecords: [],
        diagnosticReason: `Verified %PDF- header (${magicBytesHex}) and structural PDF markers (obj/endobj, xref, startxref, %%EOF) across ${byteLength.toLocaleString()} bytes.`,
      };
    }

    return {
      isValidPdf: false,
      headerValid: true,
      structurallyValid: false,
      checksumRecorded: false,
      byteLength,
      magicBytesHex,
      isHtmlPayload: false,
      isJsonPayload: false,
      extractedRecords: [],
      diagnosticReason: structuralCheck.reason || 'Rejected structurally corrupt PDF.',
    };
  }

  // Decode up to first 256KB as UTF-8 text to inspect HTML or JSON payload
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const textSample = decoder.decode(bytes.subarray(0, Math.min(byteLength, 262144)));
  const trimmed = textSample.trim();
  const lower = trimmed.slice(0, 512).toLowerCase();

  const isHtmlPayload =
    lower.startsWith('<!doctype html') ||
    lower.startsWith('<html') ||
    lower.includes('<head') ||
    lower.includes('<body') ||
    lower.includes('<table');

  const isJsonPayload = trimmed.startsWith('{') || trimmed.startsWith('[');

  const extractedRecords =
    isHtmlPayload || isJsonPayload ? extractStructuredRecordsFromText(textSample, ctx) : [];

  if (isHtmlPayload) {
    const titleMatch = textSample.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'HTML Document';
    return {
      isValidPdf: false,
      headerValid: false,
      structurallyValid: false,
      checksumRecorded: false,
      byteLength,
      magicBytesHex: magicBytesHex || 'EMPTY',
      isHtmlPayload: true,
      isJsonPayload: false,
      extractedRecords,
      diagnosticReason:
        extractedRecords.length > 0
          ? `Received HTML portal response ("${pageTitle}") — extracted ${extractedRecords.length} tabular Khatian/Dag rows. Raw PDF stream not returned.`
          : `Received HTML web page ("${pageTitle}", magic ${magicBytesHex}) instead of %PDF- binary. Never saved as .pdf.`,
    };
  }

  if (isJsonPayload) {
    return {
      isValidPdf: false,
      headerValid: false,
      structurallyValid: false,
      checksumRecorded: false,
      byteLength,
      magicBytesHex: magicBytesHex || 'EMPTY',
      isHtmlPayload: false,
      isJsonPayload: true,
      extractedRecords,
      diagnosticReason:
        extractedRecords.length > 0
          ? `Received JSON payload — extracted ${extractedRecords.length} structured Khatian/Dag rows.`
          : `Received JSON payload (${byteLength} bytes) without %PDF- binary header.`,
    };
  }

  return {
    isValidPdf: false,
    headerValid: false,
    structurallyValid: false,
    checksumRecorded: false,
    byteLength,
    magicBytesHex: magicBytesHex || 'EMPTY',
    isHtmlPayload: false,
    isJsonPayload: false,
    extractedRecords: [],
    diagnosticReason: `Invalid binary header (${magicBytesHex || '0 bytes'}): expected 25 50 44 46 2D (%PDF-), structural EOF/xref markers, and > 1,024 bytes.`,
  };
}

export async function inspectBinaryPayloadWithChecksum(
  buffer: ArrayBuffer,
  ctx: ValidationContext
): Promise<BinaryValidationResult> {
  const base = inspectBinaryPayload(buffer, ctx);
  if (buffer.byteLength === 0) {
    return base;
  }
  const sha256 = await computeSha256Hex(buffer);
  return {
    ...base,
    sha256,
    checksumRecorded: true,
  };
}

