export class CancellationException extends Error {
  constructor(message = "Task was cancelled") {
    super(message);
    this.name = "CancellationException";
  }
}

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

/**
 * Implements Phase 7 / Part 8 requirements: Seven-Mouza Download Batching.
 * Splits a list of Mouzas into batches of exactly 7 (except the final batch).
 */
export function batchMouzasForQueue(mouzas: MouzaNode[], batchSize: number = 7): MouzaNode[][] {
  const batches: MouzaNode[][] = [];
  for (let i = 0; i < mouzas.length; i += batchSize) {
    batches.push(mouzas.slice(i, i + batchSize));
  }
  return batches;
}

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
  // Explicitly iterate through the entire upazila.mouzas list (and any custom Mouzas) with zero slice/length limits
  const allMouzas: MouzaNode[] = [];
  const selectedMouzaIds: string[] = [];

  for (const mouza of params.upazila.mouzas) {
    allMouzas.push(mouza);
    selectedMouzaIds.push(mouza.id);
  }

  if (params.customMouzas && params.customMouzas.length > 0) {
    for (const customMouza of params.customMouzas) {
      if (!selectedMouzaIds.includes(customMouza.id)) {
        allMouzas.push(customMouza);
        selectedMouzaIds.push(customMouza.id);
      }
    }
  }

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

/**
 * Reorders a single task in the queue via drag-and-drop (sourceTaskId -> targetTaskId index)
 * without clearing the queue or resetting any task statuses.
 */
export function reorderQueueTasks(
  tasks: QueueTask[],
  sourceTaskId: string,
  targetTaskId: string
): QueueTask[] {
  if (sourceTaskId === targetTaskId) return tasks;
  const sourceIndex = tasks.findIndex((t) => t.id === sourceTaskId);
  const targetIndex = tasks.findIndex((t) => t.id === targetTaskId);
  if (sourceIndex === -1 || targetIndex === -1) return tasks;

  const next = [...tasks];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

/**
 * Moves a specific task UP, DOWN, or to the TOP of the processing priority
 * without clearing the queue or losing completed/cached state.
 */
export function moveQueueTaskByOffset(
  tasks: QueueTask[],
  taskId: string,
  direction: 'UP' | 'DOWN' | 'TOP'
): QueueTask[] {
  const currentIndex = tasks.findIndex((t) => t.id === taskId);
  if (currentIndex === -1) return tasks;

  if (direction === 'UP') {
    if (currentIndex === 0) return tasks;
    const next = [...tasks];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(currentIndex - 1, 0, moved);
    return next;
  }

  if (direction === 'DOWN') {
    if (currentIndex >= tasks.length - 1) return tasks;
    const next = [...tasks];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(currentIndex + 1, 0, moved);
    return next;
  }

  // direction === 'TOP': place right at the first QUEUED slot (or index 0) so it runs next
  const firstQueuedIdx = tasks.findIndex((t) => t.status === 'QUEUED');
  const insertAt = firstQueuedIdx !== -1 ? Math.min(firstQueuedIdx, currentIndex) : 0;
  if (currentIndex === insertAt) return tasks;

  const next = [...tasks];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(insertAt, 0, moved);
  return next;
}

/**
 * Prioritizes all tasks for a specific Mouza (mouzaId) by moving its pending/queued tasks
 * to the front of the queue without clearing or resetting any completed tasks.
 */
export function prioritizeMouzaInQueue(
  tasks: QueueTask[],
  mouzaId: string
): QueueTask[] {
  const hasMouza = tasks.some((t) => t.mouzaId === mouzaId);
  if (!hasMouza) return tasks;

  const completedOrActiveBeforeFirstQueued: QueueTask[] = [];
  const targetMouzaTasks: QueueTask[] = [];
  const remainingTasks: QueueTask[] = [];

  let seenQueued = false;
  for (const t of tasks) {
    if (t.mouzaId === mouzaId) {
      targetMouzaTasks.push(t);
    } else if (!seenQueued && t.status !== 'QUEUED') {
      completedOrActiveBeforeFirstQueued.push(t);
    } else {
      if (t.status === 'QUEUED') seenQueued = true;
      remainingTasks.push(t);
    }
  }

  return [
    ...completedOrActiveBeforeFirstQueued,
    ...targetMouzaTasks,
    ...remainingTasks,
  ];
}


export async function processSingleQueueTaskWithRetry(
  task: QueueTask,
  proxyConfig: ProxyConfig,
  maxRetries = 3
): Promise<{ updatedTask: QueueTask; extractedCount: number }> {
  let currentAttempt = 0;
  let lastOutcome: { updatedTask: QueueTask; extractedCount: number } | null = null;

  while (currentAttempt < maxRetries) {
    currentAttempt++;
    try {
      const outcome = await processSingleQueueTask(task, proxyConfig);
      
      // If success, return immediately
      if (
        outcome.updatedTask.status === 'CACHED_INDEXEDDB' ||
        outcome.updatedTask.status === 'HTML_INDEX_EXTRACTED'
      ) {
        return outcome;
      }

      // If it's a permanent failure, return outcome
      if (outcome.updatedTask.status === 'NOT_AVAILABLE_ON_EPORCHA_TECH') {
        return outcome;
      }
      
      lastOutcome = outcome;
      
      // If not successful, wait with exponential backoff before retrying
      if (currentAttempt < maxRetries) {
        const delayMs = currentAttempt * 2000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      if (error instanceof CancellationException) throw error;
      console.error(`Attempt ${currentAttempt} failed for task ${task.id}:`, error);
      if (currentAttempt >= maxRetries) {
        lastOutcome = {
            updatedTask: {
                ...task,
                status: 'FAILED_RETRY',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                updatedAt: new Date().toISOString(),
            },
            extractedCount: 0
        };
      }
    }
  }

  return lastOutcome || { updatedTask: task, extractedCount: 0 };
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

export const BASELINE_DOC_TYPE_AVG_BYTES: Record<EporchaEndpointType, number> = {
  'mouza-vittik-khatian': 180 * 1024, // ~180 KB full Mouza Khatian book baseline
  'mouza-vittik-dag': 140 * 1024, // ~140 KB full Mouza Dag book baseline
  'survey-khatian': 48 * 1024, // ~48 KB survey Khatian record baseline
  'namjari-khatian': 52 * 1024, // ~52 KB mutation Khatian baseline
  'mouza-map': 320 * 1024, // ~320 KB high-res Mouza map sheet baseline
  'khatian-index': 95 * 1024, // ~95 KB Khatian index & ownership summary baseline
};

export interface DocumentTypeSizeStats {
  endpointType: EporchaEndpointType;
  sampleCount: number;
  averageBytes: number;
  minBytes: number;
  maxBytes: number;
  usingBaseline: boolean;
}

export type TaskIntegrityStatus =
  | 'INTEGRITY_VERIFIED'
  | 'PARTIAL_SUSPECT'
  | 'CORRUPTED_OR_TRUNCATED'
  | 'PENDING';

export interface TaskIntegrityCheckResult {
  status: TaskIntegrityStatus;
  label: string;
  taskBytes: number;
  averageBytes: number;
  ratioToAverage: number;
  deviationPercent: number;
  sampleCount: number;
  usingBaseline: boolean;
  reason: string;
}

/**
 * Computes average downloaded byte sizes per EporchaEndpointType across the queue.
 * Uses observed cohort average when >= 2 valid (> 1024B) downloads exist for that document type,
 * or falls back to the forensic baseline for that document type.
 */
export function computeDocumentTypeSizeStats(
  tasks: Array<Pick<QueueTask, 'endpointType' | 'byteLength' | 'status'>>
): Record<EporchaEndpointType, DocumentTypeSizeStats> {
  const buckets: Record<EporchaEndpointType, number[]> = {
    'mouza-vittik-khatian': [],
    'mouza-vittik-dag': [],
    'survey-khatian': [],
    'namjari-khatian': [],
    'mouza-map': [],
    'khatian-index': [],
  };

  for (const t of tasks) {
    if (
      t.byteLength !== undefined &&
      t.byteLength > 0 &&
      t.status !== 'QUEUED' &&
      t.status !== 'FETCHING_EPORCHA_TECH'
    ) {
      const list = buckets[t.endpointType];
      if (list) {
        list.push(t.byteLength);
      }
    }
  }

  const result = {} as Record<EporchaEndpointType, DocumentTypeSizeStats>;
  (Object.keys(BASELINE_DOC_TYPE_AVG_BYTES) as EporchaEndpointType[]).forEach(
    (endpointType) => {
      const samples = buckets[endpointType] || [];
      const validSamples = samples.filter((b) => b >= MIN_VALID_PDF_BYTES);
      const baseline = BASELINE_DOC_TYPE_AVG_BYTES[endpointType];

      if (validSamples.length >= 2) {
        const sum = validSamples.reduce((acc, v) => acc + v, 0);
        const avg = Math.round(sum / validSamples.length);
        result[endpointType] = {
          endpointType,
          sampleCount: validSamples.length,
          averageBytes: avg,
          minBytes: Math.min(...validSamples),
          maxBytes: Math.max(...validSamples),
          usingBaseline: false,
        };
      } else {
        result[endpointType] = {
          endpointType,
          sampleCount: samples.length,
          averageBytes: baseline,
          minBytes: samples.length > 0 ? Math.min(...samples) : baseline,
          maxBytes: samples.length > 0 ? Math.max(...samples) : baseline,
          usingBaseline: true,
        };
      }
    }
  );

  return result;
}

/**
 * Cross-references a task's downloaded byte size against the average size for its document type
 * to flag potential partial or corrupted downloads.
 */
export function evaluateTaskSizeIntegrity(
  task: Pick<
    QueueTask,
    'endpointType' | 'byteLength' | 'status' | 'pdfVerified'
  >,
  statsByType: Record<EporchaEndpointType, DocumentTypeSizeStats>
): TaskIntegrityCheckResult {
  const typeStats = statsByType[task.endpointType] || {
    endpointType: task.endpointType,
    sampleCount: 0,
    averageBytes: BASELINE_DOC_TYPE_AVG_BYTES[task.endpointType] || 48 * 1024,
    minBytes: 0,
    maxBytes: 0,
    usingBaseline: true,
  };

  const avgBytes = Math.max(1024, typeStats.averageBytes);

  if (
    task.status === 'QUEUED' ||
    task.status === 'FETCHING_EPORCHA_TECH' ||
    task.byteLength === undefined
  ) {
    return {
      status: 'PENDING',
      label: 'Awaiting Payload',
      taskBytes: 0,
      averageBytes: avgBytes,
      ratioToAverage: 0,
      deviationPercent: 0,
      sampleCount: typeStats.sampleCount,
      usingBaseline: typeStats.usingBaseline,
      reason: `Pending download. Expected ~${(avgBytes / 1024).toFixed(1)} KB avg for /${task.endpointType}.`,
    };
  }

  const bytes = task.byteLength;
  const ratio = bytes / avgBytes;
  const deviationPercent = Math.round((ratio - 1) * 100);
  const avgKb = (avgBytes / 1024).toFixed(1);
  const taskKb = (bytes / 1024).toFixed(1);
  const sourceNote = typeStats.usingBaseline
    ? `baseline avg ${avgKb} KB`
    : `cohort avg ${avgKb} KB (${typeStats.sampleCount} files)`;

  // 1. Hard corruption or severe truncation: < 1,024B minimum PDF gate or < 45% of document-type average
  if (bytes < MIN_VALID_PDF_BYTES || ratio < 0.45) {
    return {
      status: 'CORRUPTED_OR_TRUNCATED',
      label: bytes < MIN_VALID_PDF_BYTES ? 'Corrupted (<1KB)' : 'Truncated / Corrupted',
      taskBytes: bytes,
      averageBytes: avgBytes,
      ratioToAverage: ratio,
      deviationPercent,
      sampleCount: typeStats.sampleCount,
      usingBaseline: typeStats.usingBaseline,
      reason: `Flagged: ${taskKb} KB is ${Math.abs(deviationPercent)}% below /${task.endpointType} ${sourceNote} — likely truncated or corrupted payload.`,
    };
  }

  // 2. Partial download suspect: between 45% and 75% of document-type average
  if (ratio < 0.75) {
    return {
      status: 'PARTIAL_SUSPECT',
      label: 'Partial Download Suspect',
      taskBytes: bytes,
      averageBytes: avgBytes,
      ratioToAverage: ratio,
      deviationPercent,
      sampleCount: typeStats.sampleCount,
      usingBaseline: typeStats.usingBaseline,
      reason: `Warning: ${taskKb} KB is ${Math.abs(deviationPercent)}% smaller than /${task.endpointType} ${sourceNote} — potential partial stream.`,
    };
  }

  // 3. Passed size cross-reference
  return {
    status: 'INTEGRITY_VERIFIED',
    label: 'Size Integrity OK',
    taskBytes: bytes,
    averageBytes: avgBytes,
    ratioToAverage: ratio,
    deviationPercent,
    sampleCount: typeStats.sampleCount,
    usingBaseline: typeStats.usingBaseline,
    reason: `Verified: ${taskKb} KB matches /${task.endpointType} ${sourceNote} (${deviationPercent >= 0 ? `+${deviationPercent}%` : `${deviationPercent}%`}).`,
  };
}

export interface DocumentTypeIntegrityHealth {
  endpointType: EporchaEndpointType;
  totalTasks: number;
  downloadedCount: number;
  verifiedCount: number;
  partialSuspectCount: number;
  corruptedCount: number;
  flaggedCount: number;
  flaggedRatePercent: number;
  expectedBaselineBytes: number;
  observedAverageBytes: number;
  referenceAverageBytes: number;
  deviationFromBaselinePercent: number;
  throttlingSuspected: boolean;
  diagnosticNote: string;
}

export interface MouzaIntegrityHealth {
  mouzaId: string;
  mouzaJlNo: string;
  mouzaNameBn: string;
  mouzaNameEn: string;
  upazilaNameEn: string;
  districtNameEn: string;
  totalTasks: number;
  downloadedCount: number;
  verifiedCount: number;
  partialSuspectCount: number;
  corruptedCount: number;
  flaggedCount: number;
  flaggedRatePercent: number;
  averageDeviationPercent: number;
  throttlingSuspected: boolean;
  healthStatus: 'HEALTHY' | 'THROTTLED_SUSPECT' | 'CRITICAL_TRUNCATION' | 'PENDING';
  affectedEndpoints: EporchaEndpointType[];
}

export interface QueueIntegrityHealthReport {
  totalTasks: number;
  downloadedCount: number;
  verifiedCount: number;
  partialSuspectCount: number;
  corruptedCount: number;
  flaggedCount: number;
  pendingCount: number;
  overallHealthScorePercent: number;
  throttlingRiskLevel: 'LOW' | 'MODERATE' | 'HIGH_THROTTLING_DETECTED';
  throttlingSummary: string;
  byDocumentType: DocumentTypeIntegrityHealth[];
  byMouza: MouzaIntegrityHealth[];
}

/**
 * Generates a comprehensive Integrity Health report across the current queue,
 * highlighting specific Mouzas and document types that frequently produce
 * smaller-than-expected file sizes (indicative of server-side throttling or truncation).
 */
export function computeQueueIntegrityHealthReport(
  tasks: QueueTask[]
): QueueIntegrityHealthReport {
  const statsByType = computeDocumentTypeSizeStats(tasks);

  let downloadedCount = 0;
  let verifiedCount = 0;
  let partialSuspectCount = 0;
  let corruptedCount = 0;
  let pendingCount = 0;

  const docTypeAccum: Record<
    EporchaEndpointType,
    {
      totalTasks: number;
      downloadedCount: number;
      verifiedCount: number;
      partialSuspectCount: number;
      corruptedCount: number;
      sumDownloadedBytes: number;
    }
  > = {
    'mouza-vittik-khatian': {
      totalTasks: 0,
      downloadedCount: 0,
      verifiedCount: 0,
      partialSuspectCount: 0,
      corruptedCount: 0,
      sumDownloadedBytes: 0,
    },
    'mouza-vittik-dag': {
      totalTasks: 0,
      downloadedCount: 0,
      verifiedCount: 0,
      partialSuspectCount: 0,
      corruptedCount: 0,
      sumDownloadedBytes: 0,
    },
    'survey-khatian': {
      totalTasks: 0,
      downloadedCount: 0,
      verifiedCount: 0,
      partialSuspectCount: 0,
      corruptedCount: 0,
      sumDownloadedBytes: 0,
    },
    'namjari-khatian': {
      totalTasks: 0,
      downloadedCount: 0,
      verifiedCount: 0,
      partialSuspectCount: 0,
      corruptedCount: 0,
      sumDownloadedBytes: 0,
    },
    'mouza-map': {
      totalTasks: 0,
      downloadedCount: 0,
      verifiedCount: 0,
      partialSuspectCount: 0,
      corruptedCount: 0,
      sumDownloadedBytes: 0,
    },
    'khatian-index': {
      totalTasks: 0,
      downloadedCount: 0,
      verifiedCount: 0,
      partialSuspectCount: 0,
      corruptedCount: 0,
      sumDownloadedBytes: 0,
    },
  };

  const mouzaAccum = new Map<
    string,
    {
      mouzaId: string;
      mouzaJlNo: string;
      mouzaNameBn: string;
      mouzaNameEn: string;
      upazilaNameEn: string;
      districtNameEn: string;
      totalTasks: number;
      downloadedCount: number;
      verifiedCount: number;
      partialSuspectCount: number;
      corruptedCount: number;
      deviationSum: number;
      affectedEndpoints: Set<EporchaEndpointType>;
    }
  >();

  for (const task of tasks) {
    const check = evaluateTaskSizeIntegrity(task, statsByType);
    const dt = docTypeAccum[task.endpointType];
    if (dt) {
      dt.totalTasks += 1;
    }

    let mz = mouzaAccum.get(task.mouzaId);
    if (!mz) {
      mz = {
        mouzaId: task.mouzaId,
        mouzaJlNo: task.mouzaJlNo,
        mouzaNameBn: task.mouzaNameBn,
        mouzaNameEn: task.mouzaNameEn,
        upazilaNameEn: task.upazilaNameEn,
        districtNameEn: task.districtNameEn,
        totalTasks: 0,
        downloadedCount: 0,
        verifiedCount: 0,
        partialSuspectCount: 0,
        corruptedCount: 0,
        deviationSum: 0,
        affectedEndpoints: new Set<EporchaEndpointType>(),
      };
      mouzaAccum.set(task.mouzaId, mz);
    }
    mz.totalTasks += 1;

    if (check.status === 'PENDING') {
      pendingCount += 1;
    } else {
      downloadedCount += 1;
      if (dt) {
        dt.downloadedCount += 1;
        dt.sumDownloadedBytes += task.byteLength || 0;
      }
      mz.downloadedCount += 1;
      mz.deviationSum += check.deviationPercent;

      if (check.status === 'INTEGRITY_VERIFIED') {
        verifiedCount += 1;
        if (dt) dt.verifiedCount += 1;
        mz.verifiedCount += 1;
      } else if (check.status === 'PARTIAL_SUSPECT') {
        partialSuspectCount += 1;
        if (dt) dt.partialSuspectCount += 1;
        mz.partialSuspectCount += 1;
        mz.affectedEndpoints.add(task.endpointType);
      } else if (check.status === 'CORRUPTED_OR_TRUNCATED') {
        corruptedCount += 1;
        if (dt) dt.corruptedCount += 1;
        mz.corruptedCount += 1;
        mz.affectedEndpoints.add(task.endpointType);
      }
    }
  }

  const byDocumentType: DocumentTypeIntegrityHealth[] = (
    Object.keys(BASELINE_DOC_TYPE_AVG_BYTES) as EporchaEndpointType[]
  ).map((endpointType) => {
    const acc = docTypeAccum[endpointType];
    const expectedBaselineBytes = BASELINE_DOC_TYPE_AVG_BYTES[endpointType];
    const observedAverageBytes =
      acc.downloadedCount > 0
        ? Math.round(acc.sumDownloadedBytes / acc.downloadedCount)
        : 0;
    const referenceAverageBytes =
      statsByType[endpointType]?.averageBytes || expectedBaselineBytes;
    const flaggedCount = acc.partialSuspectCount + acc.corruptedCount;
    const flaggedRatePercent =
      acc.downloadedCount > 0
        ? Math.round((flaggedCount / acc.downloadedCount) * 100)
        : 0;
    const deviationFromBaselinePercent =
      acc.downloadedCount > 0
        ? Math.round(
            ((observedAverageBytes - expectedBaselineBytes) /
              expectedBaselineBytes) *
              100
          )
        : 0;

    const throttlingSuspected =
      acc.downloadedCount > 0 &&
      (flaggedRatePercent >= 30 ||
        observedAverageBytes < expectedBaselineBytes * 0.65);

    let diagnosticNote = `Awaiting downloads (Baseline ~${(
      expectedBaselineBytes / 1024
    ).toFixed(0)} KB).`;
    if (acc.downloadedCount > 0) {
      if (throttlingSuspected) {
        diagnosticNote = `Server-side throttling suspected: ${flaggedCount}/${acc.downloadedCount} files (${flaggedRatePercent}%) smaller than expected (Observed avg ${(
          observedAverageBytes / 1024
        ).toFixed(1)} KB vs ${(expectedBaselineBytes / 1024).toFixed(0)} KB baseline).`;
      } else if (flaggedCount > 0) {
        diagnosticNote = `${flaggedCount} of ${acc.downloadedCount} downloads flagged for below-average size (${flaggedRatePercent}%).`;
      } else {
        diagnosticNote = `All ${acc.downloadedCount} downloaded files match expected size profile (Avg ${(
          observedAverageBytes / 1024
        ).toFixed(1)} KB).`;
      }
    }

    return {
      endpointType,
      totalTasks: acc.totalTasks,
      downloadedCount: acc.downloadedCount,
      verifiedCount: acc.verifiedCount,
      partialSuspectCount: acc.partialSuspectCount,
      corruptedCount: acc.corruptedCount,
      flaggedCount,
      flaggedRatePercent,
      expectedBaselineBytes,
      observedAverageBytes,
      referenceAverageBytes,
      deviationFromBaselinePercent,
      throttlingSuspected,
      diagnosticNote,
    };
  });

  const byMouza: MouzaIntegrityHealth[] = Array.from(mouzaAccum.values())
    .map((m) => {
      const flaggedCount = m.partialSuspectCount + m.corruptedCount;
      const flaggedRatePercent =
        m.downloadedCount > 0
          ? Math.round((flaggedCount / m.downloadedCount) * 100)
          : 0;
      const averageDeviationPercent =
        m.downloadedCount > 0
          ? Math.round(m.deviationSum / m.downloadedCount)
          : 0;

      const throttlingSuspected =
        m.downloadedCount > 0 &&
        (flaggedCount >= 2 ||
          flaggedRatePercent >= 40 ||
          averageDeviationPercent <= -30);

      let healthStatus: MouzaIntegrityHealth['healthStatus'] = 'PENDING';
      if (m.downloadedCount > 0) {
        if (m.corruptedCount > 0 && flaggedRatePercent >= 50) {
          healthStatus = 'CRITICAL_TRUNCATION';
        } else if (throttlingSuspected || flaggedCount > 0) {
          healthStatus = 'THROTTLED_SUSPECT';
        } else {
          healthStatus = 'HEALTHY';
        }
      }

      return {
        mouzaId: m.mouzaId,
        mouzaJlNo: m.mouzaJlNo,
        mouzaNameBn: m.mouzaNameBn,
        mouzaNameEn: m.mouzaNameEn,
        upazilaNameEn: m.upazilaNameEn,
        districtNameEn: m.districtNameEn,
        totalTasks: m.totalTasks,
        downloadedCount: m.downloadedCount,
        verifiedCount: m.verifiedCount,
        partialSuspectCount: m.partialSuspectCount,
        corruptedCount: m.corruptedCount,
        flaggedCount,
        flaggedRatePercent,
        averageDeviationPercent,
        throttlingSuspected,
        healthStatus,
        affectedEndpoints: Array.from(m.affectedEndpoints),
      };
    })
    .sort((a, b) => {
      if (b.flaggedCount !== a.flaggedCount) {
        return b.flaggedCount - a.flaggedCount;
      }
      if (b.flaggedRatePercent !== a.flaggedRatePercent) {
        return b.flaggedRatePercent - a.flaggedRatePercent;
      }
      return a.averageDeviationPercent - b.averageDeviationPercent;
    });

  const flaggedCount = partialSuspectCount + corruptedCount;
  const overallHealthScorePercent =
    downloadedCount > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((verifiedCount + partialSuspectCount * 0.4) / downloadedCount) *
                100
            )
          )
        )
      : 100;

  const flaggedRateOverall =
    downloadedCount > 0 ? (flaggedCount / downloadedCount) * 100 : 0;
  const throttledDocTypesCount = byDocumentType.filter(
    (d) => d.throttlingSuspected
  ).length;
  const throttledMouzasCount = byMouza.filter(
    (m) => m.throttlingSuspected
  ).length;

  let throttlingRiskLevel: QueueIntegrityHealthReport['throttlingRiskLevel'] =
    'LOW';
  let throttlingSummary =
    downloadedCount === 0
      ? 'No completed downloads yet. Start the queue to monitor payload size integrity and server-side throttling in real time.'
      : `All ${downloadedCount} downloaded payloads are within normal size tolerances. No server-side rate-limiting or truncation detected.`;

  if (
    downloadedCount > 0 &&
    (flaggedRateOverall >= 35 ||
      throttledDocTypesCount >= 1 ||
      throttledMouzasCount >= 2)
  ) {
    throttlingRiskLevel = 'HIGH_THROTTLING_DETECTED';
    throttlingSummary = `High throttling / truncation signature detected: ${flaggedCount} of ${downloadedCount} files (${Math.round(
      flaggedRateOverall
    )}%) across ${throttledMouzasCount} Mouza(s) returned smaller-than-expected payloads. Consider increasing polite jitter delay (e.g., 900ms–1600ms) and re-queuing flagged tasks.`;
  } else if (downloadedCount > 0 && flaggedCount > 0) {
    throttlingRiskLevel = 'MODERATE';
    throttlingSummary = `Moderate size variance: ${flaggedCount} of ${downloadedCount} downloaded files (${Math.round(
      flaggedRateOverall
    )}%) were smaller than their document-type average. Inspect flagged Mouzas below to re-verify.`;
  }

  return {
    totalTasks: tasks.length,
    downloadedCount,
    verifiedCount,
    partialSuspectCount,
    corruptedCount,
    flaggedCount,
    pendingCount,
    overallHealthScorePercent,
    throttlingRiskLevel,
    throttlingSummary,
    byDocumentType,
    byMouza,
  };
}

/**
 * Resets tasks that failed size integrity checks (PARTIAL_SUSPECT or CORRUPTED_OR_TRUNCATED)
 * back to QUEUED so they can be re-fetched cleanly, optionally scoped to a specific mouzaId or endpointType.
 */
export function requeueIntegrityFlaggedTasks(
  tasks: QueueTask[],
  filter?: { mouzaId?: string; endpointType?: EporchaEndpointType }
): { updatedTasks: QueueTask[]; requeuedCount: number } {
  const statsByType = computeDocumentTypeSizeStats(tasks);
  const nowIso = new Date().toISOString();
  let requeuedCount = 0;

  const updatedTasks = tasks.map((t) => {
    if (filter?.mouzaId && t.mouzaId !== filter.mouzaId) return t;
    if (filter?.endpointType && t.endpointType !== filter.endpointType) return t;

    const check = evaluateTaskSizeIntegrity(t, statsByType);
    if (
      check.status === 'PARTIAL_SUSPECT' ||
      check.status === 'CORRUPTED_OR_TRUNCATED'
    ) {
      requeuedCount += 1;
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

  return { updatedTasks, requeuedCount };
}



