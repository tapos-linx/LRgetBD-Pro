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

export function extractStructuredRecordsFromText(
  text: string,
  ctx: ValidationContext
): KhatianRecord[] {
  const records: KhatianRecord[] = [];
  const trimmed = text.trim();
  const nowIso = new Date().toISOString();

  // 1. Check if valid JSON array or object with khatian/dag rows
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

  // 2. Parse HTML table rows (`<tr>...<td>...</td>...</tr>`) if present in eporcha.tech HTML response
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

  // 3. Also discover any embedded document/resource links or Mouza endpoint references found on the URL
  if (records.length === 0 && trimmed.length > 0) {
    const titleMatch = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? stripTags(titleMatch[1]) : '';
    const linkRegex = /href=["']([^"']+\.(?:pdf|json|csv|xlsx?|docx?|png|jpg)|\/(?:survey-khatian|namjari-khatian|mouza-vittik-khatian|mouza-vittik-dag|mouza-map)[^"']*)["']/gi;
    const discoveredLinks = new Set<string>();
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(trimmed)) !== null) {
      discoveredLinks.add(linkMatch[1]);
    }
    if (pageTitle || discoveredLinks.size > 0) {
      records.push({
        recordId: `${ctx.mouzaJlNo}_${ctx.surveyType}_URL_RECORD`,
        districtName: ctx.districtName,
        upazilaName: ctx.upazilaName,
        unionName: ctx.unionName,
        mouzaNameEn: ctx.mouzaNameEn,
        mouzaNameBn: ctx.mouzaNameBn,
        mouzaJlNo: ctx.mouzaJlNo,
        surveyType: ctx.surveyType,
        khatianNo: `JL-${ctx.mouzaJlNo}`,
        ownerName: pageTitle || `${ctx.mouzaNameBn} (${ctx.mouzaNameEn}) Portal Record`,
        dagNo:
          discoveredLinks.size > 0
            ? `${discoveredLinks.size} Endpoint/Doc Links Found`
            : 'Full Mouza Stream',
        totalLandAcres: 'All Mouza Dags',
        sourceUrl: ctx.sourceUrl,
        extractedAt: nowIso,
      });
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
  const startsWithPdf = hasPdfMagicSignature(bytes);

  if (startsWithPdf && byteLength > MIN_VALID_PDF_BYTES) {
    return {
      isValidPdf: true,
      byteLength,
      magicBytesHex,
      isHtmlPayload: false,
      isJsonPayload: false,
      extractedRecords: [],
      diagnosticReason: `Verified %PDF- binary header (${magicBytesHex}) with ${byteLength.toLocaleString()} bytes (> 1,024B gate).`,
    };
  }

  if (startsWithPdf && byteLength <= MIN_VALID_PDF_BYTES) {
    return {
      isValidPdf: false,
      byteLength,
      magicBytesHex,
      isHtmlPayload: false,
      isJsonPayload: false,
      extractedRecords: [],
      diagnosticReason: `Rejected truncated PDF: header starts with %PDF- (${magicBytesHex}) but size is only ${byteLength} bytes (must exceed ${MIN_VALID_PDF_BYTES} bytes).`,
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
    byteLength,
    magicBytesHex: magicBytesHex || 'EMPTY',
    isHtmlPayload: false,
    isJsonPayload: false,
    extractedRecords: [],
    diagnosticReason: `Invalid binary header (${magicBytesHex || '0 bytes'}): expected 25 50 44 46 2D (%PDF-) and > 1,024 bytes.`,
  };
}
