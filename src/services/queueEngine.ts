import JSZip from 'jszip';
import {
  BookStyleConfig,
  DistrictNode,
  DivisionNode,
  EporchaEndpointType,
  MouzaNode,
  ProxyConfig,
  QueueTask,
  SurveyType,
  UpazilaNode,
  VerifiedBlobRecord,
} from '../types/land';
import { generateTasksForMouzasAndEndpoints } from '../data/geoHierarchy';
import { hasPdfMagicSignature, MIN_VALID_PDF_BYTES } from './binaryValidator';
import { fetchFromEporchaTech } from './eporchaTechClient';
import {
  getAllVerifiedPdfBlobs,
  saveExtractedKhatianRecords,
  saveVerifiedPdfBlob,
} from './storageService';

export function buildQueueTasksForUpazila(params: {
  division: DivisionNode;
  district: DistrictNode;
  upazila: UpazilaNode;
  customMouzas?: MouzaNode[];
  endpoints: EporchaEndpointType[];
  surveys: SurveyType[];
  bookStyle: BookStyleConfig;
  khatianNo?: string;
  mapSheetNo?: number;
}): {
  allMouzas: MouzaNode[];
  selectedMouzaIds: string[];
  tasks: QueueTask[];
} {
  const allMouzas = [...params.upazila.mouzas, ...(params.customMouzas || [])];
  const selectedMouzaIds = allMouzas.map((m) => m.id);
  const tasks = generateTasksForMouzasAndEndpoints({
    divisionNameEn: params.division.nameEn,
    divisionSlug: params.division.eporchaSlug,
    districtNameEn: params.district.nameEn,
    districtNameBn: params.district.nameBn,
    districtSlug: params.district.eporchaSlug,
    upazilaNameEn: params.upazila.nameEn,
    upazilaNameBn: params.upazila.nameBn,
    upazilaSlug: params.upazila.eporchaSlug,
    mouzas: allMouzas,
    endpoints: params.endpoints,
    surveys: params.surveys,
    bookStyle: params.bookStyle,
    khatianNo: params.khatianNo || 'ALL',
    mapSheetNo: params.mapSheetNo || 1,
  });

  return {
    allMouzas,
    selectedMouzaIds,
    tasks,
  };
}

export function buildUnifiedQueueForDocumentSelection(params: {
  division: DivisionNode;
  district: DistrictNode;
  upazila: UpazilaNode;
  allMouzasForUpazila: MouzaNode[];
  currentSelectedMouzaIds: string[];
  endpoints: EporchaEndpointType[];
  surveys: SurveyType[];
  bookStyle: BookStyleConfig;
  khatianNo?: string;
  mapSheetNo?: number;
}): {
  selectedMouzaIds: string[];
  selectedMouzas: MouzaNode[];
  tasks: QueueTask[];
} {
  const matchedMouzas = params.allMouzasForUpazila.filter((m) =>
    params.currentSelectedMouzaIds.includes(m.id)
  );
  const selectedMouzas =
    params.currentSelectedMouzaIds.length === 0 || matchedMouzas.length === 0
      ? params.allMouzasForUpazila
      : matchedMouzas;
  const selectedMouzaIds = selectedMouzas.map((m) => m.id);

  const tasks = generateTasksForMouzasAndEndpoints({
    divisionNameEn: params.division.nameEn,
    divisionSlug: params.division.eporchaSlug,
    districtNameEn: params.district.nameEn,
    districtNameBn: params.district.nameBn,
    districtSlug: params.district.eporchaSlug,
    upazilaNameEn: params.upazila.nameEn,
    upazilaNameBn: params.upazila.nameBn,
    upazilaSlug: params.upazila.eporchaSlug,
    mouzas: selectedMouzas,
    endpoints: params.endpoints,
    surveys: params.surveys,
    bookStyle: params.bookStyle,
    khatianNo: params.khatianNo || 'ALL',
    mapSheetNo: params.mapSheetNo || 1,
  });

  return {
    selectedMouzaIds,
    selectedMouzas,
    tasks,
  };
}

export function calculatePoliteJitterDelay(minMs = 450, maxMs = 900, seedIndex = 0): number {
  const clampedMin = Math.max(200, Math.min(minMs, maxMs));
  const clampedMax = Math.max(clampedMin, maxMs);
  const spread = clampedMax - clampedMin;
  if (spread === 0) return clampedMin;
  // Deterministic-friendly offset mixed with time step
  const stepOffset = (seedIndex * 173 + 89) % (spread + 1);
  return clampedMin + stepOffset;
}

/**
 * Resets all tasks that previously failed or encountered CORS errors back to QUEUED,
 * incrementing their retryCount and updating the timestamp.
 */
export function retryFailedTasks(tasks: QueueTask[]): {
  updatedTasks: QueueTask[];
  retriedCount: number;
} {
  const nowIso = new Date().toISOString();
  let count = 0;

  const updatedTasks = tasks.map((t) => {
    if (
      t.status === 'FAILED_RETRY' ||
      t.status === 'CORS_BRIDGE_REQUIRED' ||
      t.status === 'NOT_AVAILABLE_ON_EPORCHA_TECH'
    ) {
      count++;
      return {
        ...t,
        status: 'QUEUED' as const,
        retryCount: (t.retryCount || 0) + 1,
        errorMessage: undefined,
        updatedAt: nowIso,
      };
    }
    return t;
  });

  return { updatedTasks, retriedCount: count };
}

/**
 * Resets all tasks in the queue back to QUEUED status.
 */
export function resetAllTasksToQueued(tasks: QueueTask[]): QueueTask[] {
  const nowIso = new Date().toISOString();
  return tasks.map((t) => ({
    ...t,
    status: 'QUEUED' as const,
    errorMessage: undefined,
    updatedAt: nowIso,
  }));
}

export async function processSingleQueueTask(
  task: QueueTask,
  proxyConfig: ProxyConfig
): Promise<{ updatedTask: QueueTask; extractedCount: number }> {
  const outcome = await fetchFromEporchaTech(task, proxyConfig);
  const nowIso = new Date().toISOString();

  if (!outcome.buffer || !outcome.validation) {
    return {
      updatedTask: {
        ...task,
        status: 'CORS_BRIDGE_REQUIRED',
        httpStatus: outcome.httpStatus,
        transportUsed: outcome.transportUsed,
        pdfVerified: false,
        errorMessage:
          outcome.errorMessage ||
          'Cross-origin fetch blocked or connection failed. Use Android APK (CapacitorHttp) or Server Relay.',
        updatedAt: nowIso,
      },
      extractedCount: 0,
    };
  }

  const { validation } = outcome;

  // Save any tabular records extracted from eporcha.tech HTML/JSON response
  if (validation.extractedRecords.length > 0) {
    await saveExtractedKhatianRecords(validation.extractedRecords);
  }

  // Case 1: Authentic %PDF- Binary Verified (> 1024 bytes)
  if (validation.isValidPdf) {
    const blobRecord: VerifiedBlobRecord = {
      taskId: task.id,
      fileName: task.fileName,
      mimeType: 'application/pdf',
      isPdfVerified: true,
      byteLength: validation.byteLength,
      magicHex: validation.magicBytesHex,
      buffer: outcome.buffer,
      targetUrl: task.targetUrl,
      verifiedAt: nowIso,
    };
    await saveVerifiedPdfBlob(blobRecord);

    return {
      updatedTask: {
        ...task,
        status: 'CACHED_INDEXEDDB',
        httpStatus: outcome.httpStatus,
        byteLength: validation.byteLength,
        magicBytesHex: validation.magicBytesHex,
        pdfVerified: true,
        extractedRowCount: validation.extractedRecords.length,
        transportUsed: outcome.transportUsed,
        errorMessage: undefined,
        updatedAt: nowIso,
      },
      extractedCount: validation.extractedRecords.length,
    };
  }

  // Case 2: Structured HTML/JSON record payload found on URL — cache in IndexedDB with authentic extension (.html / .json)
  if (
    outcome.httpStatus >= 200 &&
    outcome.httpStatus < 300 &&
    validation.byteLength > 0 &&
    (validation.isHtmlPayload || validation.isJsonPayload || validation.extractedRecords.length > 0)
  ) {
    const ext = validation.isJsonPayload ? '.json' : '.html';
    const authenticFileName = task.fileName.replace(/\.pdf$/i, ext);
    const blobRecord: VerifiedBlobRecord = {
      taskId: task.id,
      fileName: authenticFileName,
      mimeType: validation.isJsonPayload ? 'application/json' : 'text/html',
      isPdfVerified: false,
      byteLength: validation.byteLength,
      magicHex: validation.magicBytesHex,
      buffer: outcome.buffer,
      targetUrl: task.targetUrl,
      verifiedAt: nowIso,
    };
    await saveVerifiedPdfBlob(blobRecord);

    return {
      updatedTask: {
        ...task,
        status: 'HTML_INDEX_EXTRACTED',
        httpStatus: outcome.httpStatus,
        byteLength: validation.byteLength,
        magicBytesHex: validation.magicBytesHex,
        pdfVerified: false,
        extractedRowCount: validation.extractedRecords.length,
        transportUsed: outcome.transportUsed,
        errorMessage: validation.diagnosticReason,
        updatedAt: nowIso,
      },
      extractedCount: validation.extractedRecords.length,
    };
  }

  // Case 3: HTTP 404/5xx or unreachable
  const isHttpError = outcome.httpStatus >= 400 || outcome.httpStatus === 0;
  return {
    updatedTask: {
      ...task,
      status:
        outcome.httpStatus === 0 ? 'CORS_BRIDGE_REQUIRED' : 'NOT_AVAILABLE_ON_EPORCHA_TECH',
      httpStatus: outcome.httpStatus,
      byteLength: validation.byteLength,
      magicBytesHex: validation.magicBytesHex,
      pdfVerified: false,
      extractedRowCount: 0,
      transportUsed: outcome.transportUsed,
      errorMessage: isHttpError
        ? `HTTP ${outcome.httpStatus} from eporcha.tech — ${validation.diagnosticReason}`
        : validation.diagnosticReason,
      updatedAt: nowIso,
    },
    extractedCount: 0,
  };
}

export function generateManifestAuditCsv(tasks: QueueTask[]): string {
  const headers = [
    'Task_ID',
    'Forensic_FileName',
    'Endpoint_Mode',
    'District',
    'Upazila',
    'Union',
    'Mouza_JL',
    'Mouza_Name_EN',
    'Mouza_Name_BN',
    'Survey_Type',
    'Book_Format',
    'Status',
    'HTTP_Status',
    'Byte_Length',
    'Magic_Bytes_Hex',
    'PDF_Verified',
    'Extracted_Rows',
    'Transport_Mode',
    'Source_URL',
    'Updated_At',
  ];

  const escapeCsv = (val: string | number | boolean | undefined) => {
    const str = val === undefined || val === null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = tasks.map((t) =>
    [
      t.id,
      t.fileName,
      t.endpointType,
      t.districtNameEn,
      t.upazilaNameEn,
      t.unionNameEn,
      t.mouzaJlNo,
      t.mouzaNameEn,
      t.mouzaNameBn,
      t.surveyType,
      t.bookStyle ? `${t.bookStyle.layout}-${t.bookStyle.colorMode}` : 'N/A',
      t.status,
      t.httpStatus ?? '',
      t.byteLength ?? 0,
      t.magicBytesHex ?? '',
      t.pdfVerified ? 'YES (%PDF-)' : 'URL_RECORD_EXTRACTED',
      t.extractedRowCount ?? 0,
      t.transportUsed ?? '',
      t.targetUrl,
      t.updatedAt,
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function generateManifestAuditMarkdown(
  tasks: QueueTask[],
  verifiedPdfCount: number
): string {
  const now = new Date().toISOString();
  const totalBytes = tasks.reduce((acc, t) => acc + (t.byteLength || 0), 0);

  const lines: string[] = [
    `# MANIFEST_AUDIT.md — LandArchive BD / LRgetBD v2.1 Forensic Archive Report`,
    ``,
    `- **Generated At:** \`${now}\``,
    `- **Target Open-Access Portal:** \`https://eporcha.tech\``,
    `- **Total Tasks Audited:** \`${tasks.length}\``,
    `- **Verified %PDF- Binaries Bundled:** \`${verifiedPdfCount}\``,
    `- **Total Downloaded Payload Size:** \`${(totalBytes / 1024).toFixed(2)} KB\``,
    `- **Anti-Hallucination Policy:** Zero synthetic/mock PDFs. Every \`.pdf\` passed \`0x25 0x50 0x44 0x46 0x2D\` (\`%PDF-\`) header verification and \`> 1024\` byte length gate; HTML/JSON URL database responses are preserved with their authentic \`.html\`/\`.json\` extensions.`,
    ``,
    `## Task Verification Matrix`,
    ``,
    `| JL No | Mouza | Survey | Mode | Forensic FileName | Status | HTTP | Magic Hex | Verified PDF |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
  ];

  for (const t of tasks) {
    lines.push(
      `| JL-${t.mouzaJlNo} | ${t.mouzaNameBn} (${t.mouzaNameEn}) | ${t.surveyType} | \`${t.endpointType}\` | \`${t.fileName}\` | \`${t.status}\` | ${t.httpStatus ?? '-'} | \`${t.magicBytesHex ?? '-'}\` | ${t.pdfVerified ? 'YES' : 'URL_RECORD'} |`
    );
  }

  return lines.join('\n');
}

export async function buildVerifiedArchiveZip(tasks: QueueTask[]): Promise<{
  zipBlob: Blob;
  verifiedPdfCount: number;
  auditFileName: string;
}> {
  const zip = new JSZip();
  const verifiedBlobs = await getAllVerifiedPdfBlobs();
  const blobMap = new Map<string, VerifiedBlobRecord>();
  for (const b of verifiedBlobs) {
    blobMap.set(b.taskId, b);
  }

  let verifiedPdfCount = 0;
  const pdfFolder = zip.folder('verified_eporcha_pdfs');
  const urlRecordsFolder = zip.folder('url_database_records');

  for (const task of tasks) {
    const stored = blobMap.get(task.id);
    if (!stored || !stored.buffer) continue;

    const bytes = new Uint8Array(stored.buffer);
    if (hasPdfMagicSignature(bytes) && stored.buffer.byteLength > MIN_VALID_PDF_BYTES) {
      pdfFolder?.file(task.fileName, stored.buffer, { binary: true });
      verifiedPdfCount++;
    } else if (stored.buffer.byteLength > 0) {
      urlRecordsFolder?.file(stored.fileName, stored.buffer, { binary: true });
    }
  }

  const csvContent = generateManifestAuditCsv(tasks);
  const mdContent = generateManifestAuditMarkdown(tasks, verifiedPdfCount);

  zip.file('MANIFEST_AUDIT.csv', csvContent);
  zip.file('MANIFEST_AUDIT.md', mdContent);

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  const auditFileName = `LandArchiveBD_eporcha_tech_${dateTag}_${tasks.length}tasks.zip`;

  return {
    zipBlob,
    verifiedPdfCount,
    auditFileName,
  };
}

export interface QueueProgressMetrics {
  totalCount: number;
  completedCount: number;
  queuedCount: number;
  failedCount: number;
  verifiedPdfCount: number;
  percentage: number;
}

export function calculateQueueProgress(
  tasks: Array<{ status: string; pdfVerified?: boolean }>
): QueueProgressMetrics {
  const totalCount = tasks.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      completedCount: 0,
      queuedCount: 0,
      failedCount: 0,
      verifiedPdfCount: 0,
      percentage: 0,
    };
  }

  let completedCount = 0;
  let queuedCount = 0;
  let failedCount = 0;
  let verifiedPdfCount = 0;

  for (const t of tasks) {
    if (t.status === 'CACHED_INDEXEDDB' || t.status === 'HTML_INDEX_EXTRACTED') {
      completedCount++;
    } else if (t.status === 'QUEUED') {
      queuedCount++;
    } else if (t.status === 'FAILED_RETRY' || t.status === 'CORS_BRIDGE_REQUIRED') {
      failedCount++;
    }

    if (t.pdfVerified) {
      verifiedPdfCount++;
    }
  }

  const rawPercent = (completedCount / totalCount) * 100;
  const percentage = Math.min(100, Math.max(0, Math.round(rawPercent)));

  return {
    totalCount,
    completedCount,
    queuedCount,
    failedCount,
    verifiedPdfCount,
    percentage,
  };
}

