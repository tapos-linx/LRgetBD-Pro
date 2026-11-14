export class CancellationException extends Error {
  constructor(message = "Task was cancelled") {
    super(message);
    this.name = "CancellationException";
  }
}

import JSZip from 'jszip';
import {
  BookStyleConfig,
  ConcurrencyTier,
  ConcurrencyTunerTelemetry,
  DistrictNode,
  DivisionNode,
  EporchaEndpointType,
  MouzaNode,
  ProxyConfig,
  QueueTask,
  SmartPauseConfig,
  SmartPauseMonitorState,
  SmartSchedulerConfig,
  SurveyType,
  UpazilaNode,
  VerifiedBlobRecord,
  WorkWindowEvaluation,
} from '../types/land';
import { generateTasksForMouzasAndEndpoints } from '../data/geoHierarchy';
import { isStructurallyValidPdf, MIN_VALID_PDF_BYTES } from './binaryValidator';
import { fetchFromEporchaTech } from './eporchaTechClient';
import {
  getAllVerifiedPdfBlobs,
  saveExtractedKhatianRecords,
  saveVerifiedPdfBlob,
} from './storageService';

/**
 * Deduplicates Mouzas by stable ID (or JL number fallback) and splits into batches of 7 unique Mouzas
 * (with a smaller final remainder permitted).
 */
export function batchMouzasForQueue(mouzas: MouzaNode[], batchSize: number = 7): MouzaNode[][] {
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const uniqueMouzas: MouzaNode[] = [];
  const seen = new Set<string>();
  for (const m of mouzas) {
    const key = m.id || `jl-${m.jlNo}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMouzas.push(m);
    }
  }

  const batches: MouzaNode[][] = [];
  for (let i = 0; i < uniqueMouzas.length; i += safeBatchSize) {
    batches.push(uniqueMouzas.slice(i, i + safeBatchSize));
  }
  return batches;
}

/**
 * Shared production queue builder that processes unique Mouzas in 7-Mouza batches
 * within a single Upazila boundary (never mixing Mouzas across different Upazilas).
 */
export function buildBatchedQueueTasks(params: {
  division: DivisionNode;
  district: DistrictNode;
  upazila: UpazilaNode;
  mouzas: MouzaNode[];
  endpoints: EporchaEndpointType[];
  surveys: SurveyType[];
  bookStyle: BookStyleConfig;
  khatianNo?: string;
  mapSheetNo?: number;
  batchSize?: number;
}): QueueTask[] {
  if (
    params.mouzas.length === 0 ||
    params.endpoints.length === 0 ||
    params.surveys.length === 0
  ) {
    return [];
  }

  const batches = batchMouzasForQueue(params.mouzas, params.batchSize ?? 7);
  const allTasks: QueueTask[] = [];

  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    const batchTasks = generateTasksForMouzasAndEndpoints({
      divisionNameEn: params.division.nameEn,
      divisionSlug: params.division.eporchaSlug,
      districtNameEn: params.district.nameEn,
      districtNameBn: params.district.nameBn,
      districtSlug: params.district.eporchaSlug,
      upazilaNameEn: params.upazila.nameEn,
      upazilaNameBn: params.upazila.nameBn,
      upazilaSlug: params.upazila.eporchaSlug,
      mouzas: batch,
      endpoints: params.endpoints,
      surveys: params.surveys,
      bookStyle: params.bookStyle,
      khatianNo: params.khatianNo || 'ALL',
      mapSheetNo: params.mapSheetNo || 1,
      batchIndex: idx + 1,
      batchTotal: batches.length,
      batchSize: batch.length,
    });
    allTasks.push(...batchTasks);
  }

  return allTasks;
}

/**
 * Merges newly generated tasks with existing queue tasks idempotently:
 * - Preserves existing completed, active, failed, retried, and checksum state for matching composite task IDs
 * - Preserves already-completed downloads (CACHED_INDEXEDDB / HTML_INDEX_EXTRACTED) so re-selection never erases completed work
 * - Never produces duplicate task IDs
 */
export function mergeQueueTasksPreservingProgress(
  existingTasks: QueueTask[],
  newTasks: QueueTask[]
): QueueTask[] {
  const existingById = new Map<string, QueueTask>();
  for (const t of existingTasks) {
    if (!existingById.has(t.id)) {
      existingById.set(t.id, t);
    }
  }

  const merged: QueueTask[] = [];
  const includedIds = new Set<string>();

  // Preserve prior completed downloads first so changing selections/endpoints never destroys verified work
  for (const existing of existingTasks) {
    if (
      (existing.status === 'CACHED_INDEXEDDB' ||
        existing.status === 'HTML_INDEX_EXTRACTED') &&
      !includedIds.has(existing.id)
    ) {
      includedIds.add(existing.id);
      merged.push(existing);
    }
  }

  for (const candidate of newTasks) {
    if (includedIds.has(candidate.id)) continue;
    const prev = existingById.get(candidate.id);
    if (prev) {
      includedIds.add(prev.id);
      // Update batch metadata if layout changed, keeping runtime state & verification metadata
      merged.push({
        ...prev,
        batchIndex: candidate.batchIndex ?? prev.batchIndex,
        batchTotal: candidate.batchTotal ?? prev.batchTotal,
        batchSize: candidate.batchSize ?? prev.batchSize,
      });
    } else {
      includedIds.add(candidate.id);
      merged.push(candidate);
    }
  }

  return merged;
}

/**
 * Recovers stale FETCHING_EPORCHA_TECH tasks left interrupted after browser reload or Android process death.
 */
export function recoverStaleQueueTasks(tasks: QueueTask[]): QueueTask[] {
  const nowIso = new Date().toISOString();
  return tasks.map((t) =>
    t.status === 'FETCHING_EPORCHA_TECH'
      ? {
          ...t,
          status: 'QUEUED' as const,
          errorMessage: 'Recovered to QUEUED after interruption/reload.',
          updatedAt: nowIso,
        }
      : t
  );
}

export function cancelQueueTask(tasks: QueueTask[], taskId: string): QueueTask[] {
  const nowIso = new Date().toISOString();
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    if (t.status === 'CACHED_INDEXEDDB' || t.status === 'HTML_INDEX_EXTRACTED') {
      return t;
    }
    return {
      ...t,
      status: 'CANCELLED' as const,
      errorMessage: 'Cancelled by user.',
      updatedAt: nowIso,
    };
  });
}

export function cancelAllPendingTasks(tasks: QueueTask[]): QueueTask[] {
  const nowIso = new Date().toISOString();
  return tasks.map((t) =>
    t.status === 'QUEUED' || t.status === 'FETCHING_EPORCHA_TECH'
      ? {
          ...t,
          status: 'CANCELLED' as const,
          errorMessage: 'Cancelled by user.',
          updatedAt: nowIso,
        }
      : t
  );
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
  batchSize?: number;
}): {
  allMouzas: MouzaNode[];
  selectedMouzaIds: string[];
  tasks: QueueTask[];
} {
  const allMouzas: MouzaNode[] = [];
  const selectedMouzaIds: string[] = [];
  const seenIds = new Set<string>();

  for (const mouza of params.upazila.mouzas) {
    if (!seenIds.has(mouza.id)) {
      seenIds.add(mouza.id);
      allMouzas.push(mouza);
      selectedMouzaIds.push(mouza.id);
    }
  }

  if (params.customMouzas && params.customMouzas.length > 0) {
    for (const customMouza of params.customMouzas) {
      if (!seenIds.has(customMouza.id)) {
        seenIds.add(customMouza.id);
        allMouzas.push(customMouza);
        selectedMouzaIds.push(customMouza.id);
      }
    }
  }

  const tasks = buildBatchedQueueTasks({
    division: params.division,
    district: params.district,
    upazila: params.upazila,
    mouzas: allMouzas,
    endpoints: params.endpoints,
    surveys: params.surveys,
    bookStyle: params.bookStyle,
    khatianNo: params.khatianNo || 'ALL',
    mapSheetNo: params.mapSheetNo || 1,
    batchSize: params.batchSize ?? 7,
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
  batchSize?: number;
}): {
  selectedMouzaIds: string[];
  selectedMouzas: MouzaNode[];
  tasks: QueueTask[];
} {
  const selectedSet = new Set(params.currentSelectedMouzaIds);
  const selectedMouzas: MouzaNode[] = [];
  const seenIds = new Set<string>();

  for (const m of params.allMouzasForUpazila) {
    if (selectedSet.has(m.id) && !seenIds.has(m.id)) {
      seenIds.add(m.id);
      selectedMouzas.push(m);
    }
  }

  const selectedMouzaIds = selectedMouzas.map((m) => m.id);
  const tasks = buildBatchedQueueTasks({
    division: params.division,
    district: params.district,
    upazila: params.upazila,
    mouzas: selectedMouzas,
    endpoints: params.endpoints,
    surveys: params.surveys,
    bookStyle: params.bookStyle,
    khatianNo: params.khatianNo || 'ALL',
    mapSheetNo: params.mapSheetNo || 1,
    batchSize: params.batchSize ?? 7,
  });

  return {
    selectedMouzaIds,
    selectedMouzas,
    tasks,
  };
}

export function calculatePoliteJitterDelay(minMs = 120, maxMs = 250, seedIndex = 0): number {
  const clampedMin = Math.max(80, Math.min(minMs, maxMs));
  const clampedMax = Math.max(clampedMin, maxMs);
  const spread = clampedMax - clampedMin;
  if (spread === 0) return clampedMin;
  const stepOffset = (seedIndex * 173 + 89) % (spread + 1);
  return clampedMin + stepOffset;
}

export function isTransientHttpStatus(httpStatus?: number): boolean {
  if (httpStatus === undefined || httpStatus === 0) return true;
  if (httpStatus === 408 || httpStatus === 425 || httpStatus === 429) return true;
  if (httpStatus >= 500 && httpStatus < 600) return true;
  return false;
}

export function isTransientTaskFailure(task: QueueTask): boolean {
  if (task.status === 'CORS_BRIDGE_REQUIRED') return true;
  if (typeof task.httpStatus === 'number' && task.httpStatus > 0) {
    return isTransientHttpStatus(task.httpStatus);
  }
  return task.status === 'FAILED_RETRY';
}

/**
 * Resets transient failed tasks back to QUEUED, enforcing retry budget.
 * Permanent 4xx failures (400, 401, 403, 404, 410, 422) transition immediately to PERMANENT_FAILURE.
 */
export function retryFailedTasks(
  tasks: QueueTask[],
  maxTaskRetryBudget = 3
): {
  updatedTasks: QueueTask[];
  retriedCount: number;
  exhaustedCount: number;
} {
  const nowIso = new Date().toISOString();
  const budget = Math.max(1, maxTaskRetryBudget || 3);
  let retriedCount = 0;
  let exhaustedCount = 0;

  const updatedTasks = tasks.map((t) => {
    if (
      t.status === 'FAILED_RETRY' ||
      t.status === 'CORS_BRIDGE_REQUIRED' ||
      t.status === 'NOT_AVAILABLE_ON_EPORCHA_TECH'
    ) {
      if (!isTransientTaskFailure(t)) {
        exhaustedCount++;
        return {
          ...t,
          status: 'PERMANENT_FAILURE' as const,
          errorMessage: `Permanent Client Error (HTTP ${t.httpStatus}) — not retried (${t.errorMessage || 'Resource rejected or not found'}).`,
          updatedAt: nowIso,
        };
      }

      const nextRetryCount = (t.retryCount || 0) + 1;
      if (nextRetryCount >= budget) {
        exhaustedCount++;
        return {
          ...t,
          status: 'PERMANENT_FAILURE' as const,
          retryCount: nextRetryCount,
          errorMessage: `Permanent Failure: Exhausted ${budget}/${budget} automatic retry budget (${t.errorMessage || 'Transient portal failure'}).`,
          updatedAt: nowIso,
        };
      }
      retriedCount++;
      return {
        ...t,
        status: 'QUEUED' as const,
        retryCount: nextRetryCount,
        errorMessage: undefined,
        updatedAt: nowIso,
      };
    }
    return t;
  });

  return { updatedTasks, retriedCount, exhaustedCount };
}

/**
 * Enforces the Smart Pause per-task automatic retry budget (`maxTaskRetryBudget`) after a task fetch attempt:
 * - Retries transient failures only (network timeouts, HTTP 0, 408, 425, 429, 5xx).
 * - Non-transient 4xx client/auth/not-found errors transition immediately to 'PERMANENT_FAILURE'.
 */
export function applyTaskRetryBudgetPolicy(
  task: QueueTask,
  maxTaskRetryBudget = 3
): {
  nextTask: QueueTask;
  autoRequeued: boolean;
  flaggedPermanentFailure: boolean;
} {
  if (
    task.status === 'CACHED_INDEXEDDB' ||
    task.status === 'HTML_INDEX_EXTRACTED' ||
    task.status === 'CANCELLED' ||
    task.status === 'PERMANENT_FAILURE'
  ) {
    return {
      nextTask: task,
      autoRequeued: false,
      flaggedPermanentFailure: false,
    };
  }

  const nowIso = task.updatedAt || new Date().toISOString();

  if (!isTransientTaskFailure(task)) {
    return {
      nextTask: {
        ...task,
        status: 'PERMANENT_FAILURE',
        errorMessage: `Permanent Error (HTTP ${task.httpStatus}): ${task.errorMessage || 'Portal returned non-retryable 4xx response'}`,
        updatedAt: nowIso,
      },
      autoRequeued: false,
      flaggedPermanentFailure: true,
    };
  }

  const budget = Math.max(1, maxTaskRetryBudget || 3);
  const nextRetryCount = (task.retryCount || 0) + 1;

  if (nextRetryCount >= budget) {
    return {
      nextTask: {
        ...task,
        status: 'PERMANENT_FAILURE',
        retryCount: nextRetryCount,
        errorMessage: `Permanent Failure: Exhausted ${budget}/${budget} automatic retry budget — ${task.errorMessage || 'Unreachable after transient retries'}`,
        updatedAt: nowIso,
      },
      autoRequeued: false,
      flaggedPermanentFailure: true,
    };
  }

  return {
    nextTask: {
      ...task,
      status: 'QUEUED',
      retryCount: nextRetryCount,
      errorMessage: `Auto-Retry ${nextRetryCount}/${budget} scheduled — ${task.errorMessage || 'Transient portal failure'}`,
      updatedAt: nowIso,
    },
    autoRequeued: true,
    flaggedPermanentFailure: false,
  };
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
): Promise<{
  updatedTask: QueueTask;
  extractedCount: number;
  latencyMs: number;
  timedOut: boolean;
}> {
  const startMs = Date.now();
  const outcome = await fetchFromEporchaTech(task, proxyConfig);
  const latencyMs = Math.max(1, Date.now() - startMs);
  const nowIso = new Date().toISOString();
  const isTimeoutOrRateLimit =
    outcome.httpStatus === 0 ||
    outcome.httpStatus === 429 ||
    outcome.httpStatus === 502 ||
    outcome.httpStatus === 503 ||
    outcome.httpStatus === 504 ||
    Boolean(outcome.errorMessage && /abort|timeout|timed out/i.test(outcome.errorMessage));

  if (!outcome.buffer || !outcome.validation) {
    return {
      updatedTask: {
        ...task,
        status: 'CORS_BRIDGE_REQUIRED',
        httpStatus: outcome.httpStatus,
        latencyMs,
        transportUsed: outcome.transportUsed,
        pdfVerified: false,
        errorMessage:
          outcome.errorMessage ||
          'Cross-origin fetch blocked or connection failed. Use Android APK (CapacitorHttp) or Server Relay.',
        updatedAt: nowIso,
      },
      extractedCount: 0,
      latencyMs,
      timedOut: true,
    };
  }

  const { validation } = outcome;

  // Save any tabular records extracted from eporcha.tech HTML/JSON response
  if (validation.extractedRecords.length > 0) {
    await saveExtractedKhatianRecords(validation.extractedRecords);
  }

  // Case 1: Authentic Structurally Valid %PDF- Binary Verified (> 1024 bytes)
  if (outcome.ok && validation.isValidPdf && validation.structurallyValid) {
    const retrievedAt = outcome.retrievedAt || nowIso;
    const finalUrl = outcome.finalUrl || task.targetUrl;
    const blobRecord: VerifiedBlobRecord = {
      taskId: task.id,
      fileName: task.fileName,
      mimeType: 'application/pdf',
      isPdfVerified: true,
      structurallyValid: validation.structurallyValid,
      byteLength: validation.byteLength,
      magicHex: validation.magicBytesHex,
      sha256: validation.sha256,
      buffer: outcome.buffer,
      targetUrl: task.targetUrl,
      finalUrl,
      verifiedAt: retrievedAt,
    };
    await saveVerifiedPdfBlob(blobRecord);

    return {
      updatedTask: {
        ...task,
        status: 'CACHED_INDEXEDDB',
        httpStatus: outcome.httpStatus,
        latencyMs,
        byteLength: validation.byteLength,
        magicBytesHex: validation.magicBytesHex,
        sha256: validation.sha256,
        finalUrl,
        mimeType: outcome.mimeType || 'application/pdf',
        retrievedAt,
        headerValid: Boolean(validation.headerValid),
        structurallyValid: Boolean(validation.structurallyValid),
        checksumRecorded: Boolean(validation.checksumRecorded),
        sourceVerified: false,
        officiallyAuthentic: false,
        pdfVerified: true,
        extractedRowCount: validation.extractedRecords.length,
        transportUsed: outcome.transportUsed,
        errorMessage: undefined,
        updatedAt: nowIso,
      },
      extractedCount: validation.extractedRecords.length,
      latencyMs,
      timedOut: false,
    };
  }

  // Case 2: Structured HTML/JSON record payload found on URL — cache in IndexedDB with authentic extension (.html / .json)
  if (
    outcome.ok &&
    outcome.httpStatus >= 200 &&
    outcome.httpStatus < 300 &&
    validation.byteLength > 0 &&
    (validation.isHtmlPayload || validation.isJsonPayload || validation.extractedRecords.length > 0)
  ) {
    const ext = validation.isJsonPayload ? '.json' : '.html';
    const authenticFileName = task.fileName.replace(/\.pdf$/i, ext);
    const retrievedAt = outcome.retrievedAt || nowIso;
    const finalUrl = outcome.finalUrl || task.targetUrl;
    const mimeType = validation.isJsonPayload ? 'application/json' : 'text/html';

    const blobRecord: VerifiedBlobRecord = {
      taskId: task.id,
      fileName: authenticFileName,
      mimeType,
      isPdfVerified: false,
      structurallyValid: false,
      byteLength: validation.byteLength,
      magicHex: validation.magicBytesHex,
      sha256: validation.sha256,
      buffer: outcome.buffer,
      targetUrl: task.targetUrl,
      finalUrl,
      verifiedAt: retrievedAt,
    };
    await saveVerifiedPdfBlob(blobRecord);

    return {
      updatedTask: {
        ...task,
        status: 'HTML_INDEX_EXTRACTED',
        httpStatus: outcome.httpStatus,
        latencyMs,
        byteLength: validation.byteLength,
        magicBytesHex: validation.magicBytesHex,
        sha256: validation.sha256,
        finalUrl,
        mimeType,
        retrievedAt,
        headerValid: false,
        structurallyValid: false,
        checksumRecorded: Boolean(validation.checksumRecorded),
        sourceVerified: false,
        officiallyAuthentic: false,
        pdfVerified: false,
        extractedRowCount: validation.extractedRecords.length,
        transportUsed: outcome.transportUsed,
        errorMessage: validation.diagnosticReason,
        updatedAt: nowIso,
      },
      extractedCount: validation.extractedRecords.length,
      latencyMs,
      timedOut: false,
    };
  }

  // Case 3: HTTP 4xx/5xx, corrupt/truncated PDF, or unreachable
  const isHttpError = outcome.httpStatus >= 400 || outcome.httpStatus === 0;
  return {
    updatedTask: {
      ...task,
      status:
        outcome.httpStatus === 0
          ? 'CORS_BRIDGE_REQUIRED'
          : isTransientHttpStatus(outcome.httpStatus)
          ? 'FAILED_RETRY'
          : 'NOT_AVAILABLE_ON_EPORCHA_TECH',
      httpStatus: outcome.httpStatus,
      latencyMs,
      byteLength: validation.byteLength,
      magicBytesHex: validation.magicBytesHex,
      sha256: validation.sha256,
      finalUrl: outcome.finalUrl || task.targetUrl,
      mimeType: outcome.mimeType,
      retrievedAt: outcome.retrievedAt || nowIso,
      headerValid: Boolean(validation.headerValid),
      structurallyValid: Boolean(validation.structurallyValid),
      checksumRecorded: Boolean(validation.checksumRecorded),
      sourceVerified: false,
      officiallyAuthentic: false,
      pdfVerified: false,
      extractedRowCount: 0,
      transportUsed: outcome.transportUsed,
      errorMessage: isHttpError
        ? `HTTP ${outcome.httpStatus} from eporcha.tech — ${validation.diagnosticReason}`
        : validation.diagnosticReason,
      updatedAt: nowIso,
    },
    extractedCount: 0,
    latencyMs,
    timedOut: isTimeoutOrRateLimit,
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
    'SHA256',
    'Verification_Tier',
    'PDF_Verified',
    'Extracted_Rows',
    'Transport_Mode',
    'Source_URL',
    'Final_URL',
    'Retrieved_At',
    'Updated_At',
  ];

  const escapeCsv = (val: string | number | boolean | undefined) => {
    const str = val === undefined || val === null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = tasks.map((t) => {
    const verificationTier = t.structurallyValid
      ? t.checksumRecorded
        ? 'checksum_recorded'
        : 'structurally_valid'
      : t.headerValid
      ? 'header_valid'
      : 'downloaded';

    return [
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
      t.sha256 ?? '',
      verificationTier,
      t.pdfVerified ? 'YES (%PDF- Structural)' : 'HTML_OR_JSON_ONLY',
      t.extractedRowCount ?? 0,
      t.transportUsed ?? '',
      t.targetUrl,
      t.finalUrl ?? t.targetUrl,
      t.retrievedAt ?? t.updatedAt,
      t.updatedAt,
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function generateManifestAuditMarkdown(
  tasks: QueueTask[],
  verifiedPdfCount: number
): string {
  const now = new Date().toISOString();
  const totalBytes = tasks.reduce((acc, t) => acc + (t.byteLength || 0), 0);

  const lines: string[] = [
    `# MANIFEST_AUDIT.md — LRgetBD-Pro v2.1 Forensic Archive Report`,
    ``,
    `- **Generated At:** \`${now}\``,
    `- **Target Portal:** \`https://eporcha.tech\``,
    `- **Total Tasks Audited:** \`${tasks.length}\``,
    `- **Structurally Valid %PDF- Binaries Bundled:** \`${verifiedPdfCount}\``,
    `- **Total Downloaded Payload Size:** \`${(totalBytes / 1024).toFixed(2)} KB\``,
    `- **Integrity Policy:** Zero synthetic/mock PDFs. Every bundled \`.pdf\` passed \`%PDF-\` header verification, structural PDF checks (obj/endobj, xref, startxref, %%EOF), \`> 1024\` byte length gate, and exact-byte SHA-256 hashing. HTML/JSON responses retain authentic \`.html\`/\`.json\` extensions and are never labeled as official authenticity proofs.`,
    ``,
    `## Task Verification Matrix`,
    ``,
    `| JL No | Mouza | Survey | Mode | Forensic FileName | Status | HTTP | Bytes | SHA-256 | Verified PDF |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
  ];

  for (const t of tasks) {
    lines.push(
      `| JL-${t.mouzaJlNo} | ${t.mouzaNameBn} (${t.mouzaNameEn}) | ${t.surveyType} | \`${t.endpointType}\` | \`${t.fileName}\` | \`${t.status}\` | ${t.httpStatus ?? '-'} | ${t.byteLength ?? 0} | \`${t.sha256 ? t.sha256.slice(0, 16) + '...' : '-'}\` | ${t.pdfVerified && t.structurallyValid ? 'YES' : 'NON-PDF'} |`
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
    if (isStructurallyValidPdf(bytes)) {
      pdfFolder?.file(task.fileName, stored.buffer, { binary: true });
      verifiedPdfCount++;
    } else if (stored.buffer.byteLength > 0) {
      const nonPdfName = stored.fileName.replace(/\.pdf$/i, '.html');
      urlRecordsFolder?.file(nonPdfName, stored.buffer, { binary: true });
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
  const auditFileName = `LRgetBD_Pro_eporcha_tech_${dateTag}_${tasks.length}tasks.zip`;

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
    } else if (
      t.status === 'FAILED_RETRY' ||
      t.status === 'CORS_BRIDGE_REQUIRED' ||
      t.status === 'NOT_AVAILABLE_ON_EPORCHA_TECH' ||
      t.status === 'PERMANENT_FAILURE'
    ) {
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

/**
 * Parses an "HH:mm" time string (e.g. "02:00" or "14:30") into minutes from midnight (0-1439).
 */
export function parseHHMMToMinutes(hhmm: string, fallbackMinutes = 120): number {
  if (!hhmm || !hhmm.includes(':')) return fallbackMinutes;
  const [hStr, mStr] = hhmm.split(':');
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMinutes;
  const clampedH = Math.max(0, Math.min(23, h));
  const clampedM = Math.max(0, Math.min(59, m));
  return clampedH * 60 + clampedM;
}

/**
 * Formats minutes since midnight into a 12-hour string like "2:00 AM" or "6:00 AM".
 */
export function formatMinutesTo12Hour(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

export function formatDurationMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.round(minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Evaluates whether the current time falls inside the user's configured Smart Batch Scheduler
 * work window (e.g., 02:00 - 06:00 / 2 AM - 6 AM) in either Bangladesh Standard Time (UTC+6)
 * or the user's local system clock, and estimates portal traffic load on eporcha.tech.
 */
export function evaluateWorkWindowStatus(
  config: SmartSchedulerConfig,
  referenceDate: Date = new Date()
): WorkWindowEvaluation {
  let currentHour = referenceDate.getHours();
  let currentMinute = referenceDate.getMinutes();

  if (config.timezoneMode === 'BD_STANDARD') {
    // Bangladesh Standard Time is strictly UTC+6 (no DST)
    const utcMs = referenceDate.getTime();
    const bstDate = new Date(utcMs + 6 * 60 * 60 * 1000);
    currentHour = bstDate.getUTCHours();
    currentMinute = bstDate.getUTCMinutes();
  }

  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const startMinutes = parseHHMMToMinutes(config.startTime, 2 * 60); // default 02:00
  const endMinutes = parseHHMMToMinutes(config.endTime, 6 * 60);     // default 06:00

  let isWithinWindow = false;
  let minutesUntilStart = 0;
  let minutesUntilEnd = 0;

  if (startMinutes === endMinutes) {
    // Full 24-hour window if start === end
    isWithinWindow = true;
    minutesUntilStart = 0;
    minutesUntilEnd = 1440;
  } else if (startMinutes < endMinutes) {
    // Standard daytime or post-midnight window (e.g., 02:00 -> 06:00)
    isWithinWindow =
      currentTotalMinutes >= startMinutes && currentTotalMinutes < endMinutes;
    if (isWithinWindow) {
      minutesUntilEnd = endMinutes - currentTotalMinutes;
      minutesUntilStart = 0;
    } else if (currentTotalMinutes < startMinutes) {
      minutesUntilStart = startMinutes - currentTotalMinutes;
      minutesUntilEnd = endMinutes - currentTotalMinutes;
    } else {
      minutesUntilStart = 1440 - currentTotalMinutes + startMinutes;
      minutesUntilEnd = 1440 - currentTotalMinutes + endMinutes;
    }
  } else {
    // Overnight window crossing midnight (e.g., 23:00 -> 05:00)
    isWithinWindow =
      currentTotalMinutes >= startMinutes || currentTotalMinutes < endMinutes;
    if (isWithinWindow) {
      minutesUntilStart = 0;
      minutesUntilEnd =
        currentTotalMinutes >= startMinutes
          ? 1440 - currentTotalMinutes + endMinutes
          : endMinutes - currentTotalMinutes;
    } else {
      minutesUntilStart = startMinutes - currentTotalMinutes;
      minutesUntilEnd = 1440 - currentTotalMinutes + endMinutes;
    }
  }

  // Estimate eporcha.tech portal traffic based on Bangladesh Standard Time hour
  const utcMs = referenceDate.getTime();
  const bstHour = new Date(utcMs + 6 * 60 * 60 * 1000).getUTCHours();
  let portalTrafficEstimate: WorkWindowEvaluation['portalTrafficEstimate'] =
    'MODERATE_TRAFFIC';
  if (bstHour >= 1 && bstHour < 7) {
    portalTrafficEstimate = 'OFF_PEAK_OPTIMAL';
  } else if (bstHour >= 9 && bstHour <= 22) {
    portalTrafficEstimate = 'PEAK_PORTAL_LOAD';
  }

  const tzSuffix = config.timezoneMode === 'BD_STANDARD' ? 'BST (UTC+6)' : 'Local';
  const currentTimeHHMM = `${String(currentHour).padStart(2, '0')}:${String(
    currentMinute
  ).padStart(2, '0')}`;
  const currentTime12h = `${formatMinutesTo12Hour(currentTotalMinutes)} ${tzSuffix}`;
  const windowLabel12h = `${formatMinutesTo12Hour(startMinutes)} – ${formatMinutesTo12Hour(
    endMinutes
  )} ${tzSuffix}`;

  const countdownText = isWithinWindow
    ? `Active work window · ${formatDurationMinutes(minutesUntilEnd)} remaining`
    : `Standby · Starts in ${formatDurationMinutes(minutesUntilStart)}`;

  return {
    isWithinWindow,
    currentTimeHHMM,
    currentTime12h,
    windowLabel12h,
    minutesUntilStart,
    minutesUntilEnd,
    countdownText,
    portalTrafficEstimate,
  };
}

export const CONCURRENCY_TIERS: readonly ConcurrencyTier[] = [1, 2, 3, 7];

export function getRegimeForConcurrency(
  tier: ConcurrencyTier
): ConcurrencyTunerTelemetry['regime'] {
  if (tier === 7) return 'TURBO_7X';
  if (tier === 3) return 'FAST_3X';
  if (tier === 2) return 'BALANCED_2X';
  return 'SAFE_BACKOFF_1X';
}

export function getJitterBoundsForConcurrency(tier: ConcurrencyTier): {
  minDelayMs: number;
  maxDelayMs: number;
} {
  switch (tier) {
    case 7:
      return { minDelayMs: 80, maxDelayMs: 180 };
    case 3:
      return { minDelayMs: 120, maxDelayMs: 250 };
    case 2:
      return { minDelayMs: 220, maxDelayMs: 420 };
    case 1:
    default:
      return { minDelayMs: 450, maxDelayMs: 850 };
  }
}

export function createInitialConcurrencyTelemetry(
  config: ProxyConfig
): ConcurrencyTunerTelemetry {
  const tier = config.concurrency || 3;
  return {
    autoTuneEnabled: config.autoTuneConcurrency ?? true,
    currentConcurrency: tier,
    rollingLatencyMs: 0,
    lastLatencyMs: 0,
    sampleCount: 0,
    consecutiveFastCount: 0,
    consecutiveSlowOrTimeoutCount: 0,
    totalScaleUps: 0,
    totalBackoffs: 0,
    lastAdjustmentReason:
      config.autoTuneConcurrency ?? true
        ? `Auto-Tuner active at ${tier}x parallel workers — monitoring portal latency.`
        : `Manual concurrency locked at ${tier}x parallel workers.`,
    regime: getRegimeForConcurrency(tier),
  };
}

/**
 * AIMD (Additive Increase / Multiplicative Decrease) Automated Concurrency Tuner:
 * Dynamically adjusts proxyConfig.concurrency (1 <-> 2 <-> 3 <-> 7) and polite jitter
 * bounds based on observed portal latency and timeout/throttling events.
 * - Increases speed when eporcha.tech responds quickly (< 1,000ms rolling latency).
 * - Immediately backs off when timeouts (HTTP 0, 429, 502-504) or high latency (>= 3,200ms) occur.
 */
export function evaluateAutoConcurrencyStep(params: {
  currentConfig: ProxyConfig;
  telemetry: ConcurrencyTunerTelemetry;
  sample: {
    latencyMs: number;
    httpStatus: number;
    timedOut?: boolean;
  };
}): {
  nextConfig: ProxyConfig;
  nextTelemetry: ConcurrencyTunerTelemetry;
  changed: boolean;
} {
  const { currentConfig, telemetry, sample } = params;
  const autoTuneEnabled = currentConfig.autoTuneConcurrency ?? true;
  const clampedLatency = Math.max(1, Math.round(sample.latencyMs));

  // Exponential moving average (EMA) of latency: 60% previous rolling + 40% new sample
  const nextRollingLatency =
    telemetry.sampleCount === 0 || telemetry.rollingLatencyMs === 0
      ? clampedLatency
      : Math.round(telemetry.rollingLatencyMs * 0.6 + clampedLatency * 0.4);

  const isTimeoutOrGatewayError =
    Boolean(sample.timedOut) ||
    sample.httpStatus === 0 ||
    sample.httpStatus === 429 ||
    sample.httpStatus === 502 ||
    sample.httpStatus === 503 ||
    sample.httpStatus === 504;

  const isSevereLatencySpike = clampedLatency >= 3200 || nextRollingLatency >= 2800;
  const isFastResponse =
    !isTimeoutOrGatewayError &&
    clampedLatency <= 1050 &&
    nextRollingLatency <= 1000;

  const currentTier = currentConfig.concurrency || 3;
  const currentIdx = Math.max(0, CONCURRENCY_TIERS.indexOf(currentTier));

  if (!autoTuneEnabled) {
    return {
      nextConfig: currentConfig,
      nextTelemetry: {
        ...telemetry,
        autoTuneEnabled: false,
        currentConcurrency: currentTier,
        rollingLatencyMs: nextRollingLatency,
        lastLatencyMs: clampedLatency,
        sampleCount: telemetry.sampleCount + 1,
        regime: getRegimeForConcurrency(currentTier),
      },
      changed: false,
    };
  }

  // 1. Multiplicative / Immediate Backoff on Timeout, 429/5xx, or Severe Latency Spike
  if (isTimeoutOrGatewayError || isSevereLatencySpike) {
    const nextSlowStreak = telemetry.consecutiveSlowOrTimeoutCount + 1;
    // Drop 2 tiers on hard timeout from 7x (7 -> 2), or 1 tier otherwise
    const stepDown = isTimeoutOrGatewayError && currentTier === 7 ? 2 : 1;
    const nextIdx = Math.max(0, currentIdx - stepDown);
    const nextTier = CONCURRENCY_TIERS[nextIdx];
    const jitter = getJitterBoundsForConcurrency(nextTier);
    const changed = nextTier !== currentTier;

    const triggerLabel = isTimeoutOrGatewayError
      ? `timeout / HTTP ${sample.httpStatus || '0'}`
      : `high latency (${clampedLatency}ms)`;

    const reason = changed
      ? `Auto-Backed Off ${currentTier}x → ${nextTier}x due to ${triggerLabel} (jitter ${jitter.minDelayMs}–${jitter.maxDelayMs}ms).`
      : `Holding minimum 1x safe concurrency due to ${triggerLabel}.`;

    return {
      nextConfig: {
        ...currentConfig,
        concurrency: nextTier,
        minDelayMs: jitter.minDelayMs,
        maxDelayMs: jitter.maxDelayMs,
      },
      nextTelemetry: {
        autoTuneEnabled: true,
        currentConcurrency: nextTier,
        rollingLatencyMs: nextRollingLatency,
        lastLatencyMs: clampedLatency,
        sampleCount: telemetry.sampleCount + 1,
        consecutiveFastCount: 0,
        consecutiveSlowOrTimeoutCount: nextSlowStreak,
        totalScaleUps: telemetry.totalScaleUps,
        totalBackoffs: changed ? telemetry.totalBackoffs + 1 : telemetry.totalBackoffs,
        lastAdjustmentReason: reason,
        regime: getRegimeForConcurrency(nextTier),
      },
      changed,
    };
  }

  // 2. Additive Speed-Up when portal responds quickly (>= 2 consecutive fast responses)
  if (isFastResponse) {
    const nextFastStreak = telemetry.consecutiveFastCount + 1;
    const shouldScaleUp =
      nextFastStreak >= 2 && currentIdx < CONCURRENCY_TIERS.length - 1;

    if (shouldScaleUp) {
      const nextTier = CONCURRENCY_TIERS[currentIdx + 1];
      const jitter = getJitterBoundsForConcurrency(nextTier);
      return {
        nextConfig: {
          ...currentConfig,
          concurrency: nextTier,
          minDelayMs: jitter.minDelayMs,
          maxDelayMs: jitter.maxDelayMs,
        },
        nextTelemetry: {
          autoTuneEnabled: true,
          currentConcurrency: nextTier,
          rollingLatencyMs: nextRollingLatency,
          lastLatencyMs: clampedLatency,
          sampleCount: telemetry.sampleCount + 1,
          consecutiveFastCount: 0, // reset streak after scaling up
          consecutiveSlowOrTimeoutCount: 0,
          totalScaleUps: telemetry.totalScaleUps + 1,
          totalBackoffs: telemetry.totalBackoffs,
          lastAdjustmentReason: `Auto-Scaled Up ${currentTier}x → ${nextTier}x (fast rolling latency ${nextRollingLatency}ms · jitter ${jitter.minDelayMs}–${jitter.maxDelayMs}ms).`,
          regime: getRegimeForConcurrency(nextTier),
        },
        changed: true,
      };
    }

    return {
      nextConfig: currentConfig,
      nextTelemetry: {
        ...telemetry,
        autoTuneEnabled: true,
        currentConcurrency: currentTier,
        rollingLatencyMs: nextRollingLatency,
        lastLatencyMs: clampedLatency,
        sampleCount: telemetry.sampleCount + 1,
        consecutiveFastCount: nextFastStreak,
        consecutiveSlowOrTimeoutCount: 0,
        lastAdjustmentReason:
          currentTier === 7
            ? `Running at maximum 7x Turbo Batch (rolling latency ${nextRollingLatency}ms).`
            : `Portal fast (${nextRollingLatency}ms avg) — ${nextFastStreak}/2 fast samples toward next speed tier.`,
        regime: getRegimeForConcurrency(currentTier),
      },
      changed: false,
    };
  }

  // 3. Moderate latency (1,000ms - 3,199ms): maintain current concurrency steady state
  return {
    nextConfig: currentConfig,
    nextTelemetry: {
      ...telemetry,
      autoTuneEnabled: true,
      currentConcurrency: currentTier,
      rollingLatencyMs: nextRollingLatency,
      lastLatencyMs: clampedLatency,
      sampleCount: telemetry.sampleCount + 1,
      consecutiveFastCount: 0,
      consecutiveSlowOrTimeoutCount: 0,
      lastAdjustmentReason: `Steady at ${currentTier}x concurrency (rolling latency ${nextRollingLatency}ms).`,
      regime: getRegimeForConcurrency(currentTier),
    },
    changed: false,
  };
}

export interface LatencyTrendPoint {
  sequenceIndex: number; // 1..N (up to 50)
  taskId: string;
  mouzaJlNo: string;
  mouzaNameEn: string;
  mouzaNameBn: string;
  surveyType: string;
  latencyMs: number;
  averageLatencyMs: number;
  httpStatus: number;
  status: string;
  updatedAt: string;
}

/**
 * Extracts up to the last `maxTasks` (default 50) executed tasks with valid latency measurements,
 * ordered chronologically by execution (`updatedAt`), and computes the running Average Fetch Latency (ms)
 * (EMA + cumulative window average) for D3.js trend visualization.
 */
export function computeLatencyTrendWindow(
  tasks: QueueTask[],
  maxTasks = 50
): {
  points: LatencyTrendPoint[];
  overallAverageMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  fastCount: number;
  slowOrTimeoutCount: number;
  trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'AWAITING_DATA';
} {
  const measuredTasks = tasks
    .filter((t) => typeof t.latencyMs === 'number' && t.latencyMs > 0)
    .slice()
    .sort((a, b) => {
      const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return timeA - timeB;
    });

  const windowTasks = measuredTasks.slice(-Math.max(1, maxTasks));

  if (windowTasks.length === 0) {
    return {
      points: [],
      overallAverageMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      fastCount: 0,
      slowOrTimeoutCount: 0,
      trendDirection: 'AWAITING_DATA',
    };
  }

  let rollingAvg = 0;
  let sumLatency = 0;
  let minLatencyMs = Infinity;
  let maxLatencyMs = 0;
  let fastCount = 0;
  let slowOrTimeoutCount = 0;

  const points: LatencyTrendPoint[] = windowTasks.map((t, idx) => {
    const rawLatency = Math.max(1, Math.round(t.latencyMs || 0));
    rollingAvg =
      idx === 0 ? rawLatency : Math.round(rollingAvg * 0.65 + rawLatency * 0.35);
    sumLatency += rawLatency;
    if (rawLatency < minLatencyMs) minLatencyMs = rawLatency;
    if (rawLatency > maxLatencyMs) maxLatencyMs = rawLatency;
    if (rawLatency <= 1000) fastCount += 1;
    if (rawLatency >= 2800 || (t.httpStatus ?? 200) === 0 || (t.httpStatus ?? 200) >= 429) {
      slowOrTimeoutCount += 1;
    }

    return {
      sequenceIndex: idx + 1,
      taskId: t.id,
      mouzaJlNo: t.mouzaJlNo,
      mouzaNameEn: t.mouzaNameEn,
      mouzaNameBn: t.mouzaNameBn,
      surveyType: t.surveyType,
      latencyMs: rawLatency,
      averageLatencyMs: rollingAvg,
      httpStatus: t.httpStatus ?? 200,
      status: t.status,
      updatedAt: t.updatedAt,
    };
  });

  const overallAverageMs = Math.round(sumLatency / points.length);

  let trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'AWAITING_DATA' = 'STABLE';
  if (points.length >= 4) {
    const half = Math.floor(points.length / 2);
    const firstHalfAvg =
      points.slice(0, half).reduce((acc, p) => acc + p.latencyMs, 0) / half;
    const secondHalfAvg =
      points.slice(half).reduce((acc, p) => acc + p.latencyMs, 0) /
      (points.length - half);
    const deltaRatio = (secondHalfAvg - firstHalfAvg) / Math.max(1, firstHalfAvg);
    if (deltaRatio <= -0.15) {
      trendDirection = 'IMPROVING';
    } else if (deltaRatio >= 0.15) {
      trendDirection = 'DEGRADING';
    }
  }

  return {
    points,
    overallAverageMs,
    minLatencyMs: minLatencyMs === Infinity ? 0 : minLatencyMs,
    maxLatencyMs,
    fastCount,
    slowOrTimeoutCount,
    trendDirection,
  };
}

export function createInitialSmartPauseState(): SmartPauseMonitorState {
  return {
    consecutiveTimeouts: 0,
    highLatencyStartedAtMs: null,
    sustainedHighLatencyElapsedMs: 0,
    isTriggered: false,
    triggerReason: null,
    triggerMessage: null,
    triggeredAtIso: null,
    queueAutoSuspended: false,
  };
}

export function formatSmartPauseDuration(durationMs: number): string {
  const totalSec = Math.max(0, Math.floor(durationMs / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

/**
 * Smart Pause Portal Health Monitor:
 * Evaluates each task completion sample and triggers a notification or automatically
 * suspends the queue when either:
 * 1) `consecutiveTimeouts >= config.consecutiveTimeoutsThreshold` (default: 3 consecutive timeouts)
 * 2) A sustained latency spike exceeding `config.sustainedLatencyThresholdMs` (default: > 3,000ms)
 *    persists continuously for more than `config.sustainedDurationMinutes` (default: > 5 minutes).
 */
export function evaluateSmartPauseStep(params: {
  config: SmartPauseConfig;
  currentState: SmartPauseMonitorState;
  sample: {
    latencyMs: number;
    httpStatus: number;
    timedOut?: boolean;
    timestampMs?: number;
  };
}): {
  nextState: SmartPauseMonitorState;
  newlyTriggered: boolean;
  shouldSuspendQueue: boolean;
} {
  const { config, currentState, sample } = params;
  const nowMs = sample.timestampMs ?? Date.now();
  const clampedLatency = Math.max(1, Math.round(sample.latencyMs));

  const isTimeout =
    Boolean(sample.timedOut) ||
    sample.httpStatus === 0 ||
    sample.httpStatus === 408 ||
    sample.httpStatus === 504;

  const isHighLatency = clampedLatency > config.sustainedLatencyThresholdMs;

  const nextConsecutiveTimeouts = isTimeout
    ? currentState.consecutiveTimeouts + 1
    : 0;

  let nextHighLatencyStartedAtMs: number | null =
    currentState.highLatencyStartedAtMs;
  let nextSustainedElapsedMs = 0;

  if (isHighLatency || isTimeout) {
    if (nextHighLatencyStartedAtMs === null) {
      nextHighLatencyStartedAtMs = nowMs;
      nextSustainedElapsedMs = 0;
    } else {
      nextSustainedElapsedMs = Math.max(0, nowMs - nextHighLatencyStartedAtMs);
    }
  } else {
    nextHighLatencyStartedAtMs = null;
    nextSustainedElapsedMs = 0;
  }

  if (!config.enabled) {
    return {
      nextState: {
        ...currentState,
        consecutiveTimeouts: nextConsecutiveTimeouts,
        highLatencyStartedAtMs: nextHighLatencyStartedAtMs,
        sustainedHighLatencyElapsedMs: nextSustainedElapsedMs,
      },
      newlyTriggered: false,
      shouldSuspendQueue: false,
    };
  }

  const timeoutThreshold = Math.max(1, config.consecutiveTimeoutsThreshold || 3);
  const sustainedThresholdMs =
    Math.max(1, config.sustainedDurationMinutes || 5) * 60 * 1000;

  const hitConsecutiveTimeouts = nextConsecutiveTimeouts >= timeoutThreshold;
  const hitSustainedSpike = nextSustainedElapsedMs > sustainedThresholdMs;

  if (hitConsecutiveTimeouts || hitSustainedSpike) {
    const triggerReason = hitConsecutiveTimeouts
      ? 'CONSECUTIVE_TIMEOUTS'
      : 'SUSTAINED_LATENCY_SPIKE';
    const shouldSuspendQueue = config.actionMode === 'AUTO_SUSPEND_AND_NOTIFY';

    const actionSuffix = shouldSuspendQueue
      ? 'Queue automatically suspended to protect session stability.'
      : 'Notification alert triggered (queue continuing in Notify-Only mode).';

    const triggerMessage = hitConsecutiveTimeouts
      ? `Smart Pause Triggered: Portal health monitor detected ${nextConsecutiveTimeouts} consecutive timeouts (threshold: ${timeoutThreshold}). ${actionSuffix}`
      : `Smart Pause Triggered: Sustained portal latency spike > ${config.sustainedLatencyThresholdMs}ms (${clampedLatency}ms latest) persisted for ${formatSmartPauseDuration(nextSustainedElapsedMs)} (> ${config.sustainedDurationMinutes}m limit). ${actionSuffix}`;

    return {
      nextState: {
        consecutiveTimeouts: nextConsecutiveTimeouts,
        highLatencyStartedAtMs: nextHighLatencyStartedAtMs,
        sustainedHighLatencyElapsedMs: nextSustainedElapsedMs,
        isTriggered: true,
        triggerReason,
        triggerMessage,
        triggeredAtIso: new Date(nowMs).toISOString(),
        queueAutoSuspended: shouldSuspendQueue,
      },
      newlyTriggered: !currentState.isTriggered,
      shouldSuspendQueue,
    };
  }

  return {
    nextState: {
      ...currentState,
      consecutiveTimeouts: nextConsecutiveTimeouts,
      highLatencyStartedAtMs: nextHighLatencyStartedAtMs,
      sustainedHighLatencyElapsedMs: nextSustainedElapsedMs,
    },
    newlyTriggered: false,
    shouldSuspendQueue: false,
  };
}






