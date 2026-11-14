import test from 'node:test';
import assert from 'node:assert/strict';
import {
  batchMouzasForQueue,
  buildBatchedQueueTasks,
  buildQueueTasksForUpazila,
  buildUnifiedQueueForDocumentSelection,
  calculatePoliteJitterDelay,
  calculateQueueProgress,
  cancelAllPendingTasks,
  cancelQueueTask,
  computeDocumentTypeSizeStats,
  computeQueueIntegrityHealthReport,
  evaluateTaskSizeIntegrity,
  mergeQueueTasksPreservingProgress,
  moveQueueTaskByOffset,
  prioritizeMouzaInQueue,
  recoverStaleQueueTasks,
  reorderQueueTasks,
  requeueIntegrityFlaggedTasks,
} from './queueEngine';
import { ALL_ENDPOINT_TYPES, ALL_SURVEY_TYPES, GEO_HIERARCHY } from '../data/geoHierarchy';
import { MouzaNode, QueueTask } from '../types/land';

function makeSampleTasks(): QueueTask[] {
  const div = GEO_HIERARCHY[0];
  const dist = div.districts[0];
  const upz = dist.upazilas[0];
  const { tasks } = buildQueueTasksForUpazila({
    division: div,
    district: dist,
    upazila: upz,
    endpoints: ['mouza-vittik-khatian'],
    surveys: ['RS'],
    bookStyle: { layout: 'new', colorMode: 'color' },
  });
  return tasks.slice(0, 4);
}

function makeSyntheticMouzas(count: number, prefix = 'mz'): MouzaNode[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}-${idx + 1}`,
    jlNo: String(idx + 1),
    nameEn: `Mouza ${idx + 1}`,
    nameBn: `মৌজা ${idx + 1}`,
    unionNameEn: 'Union A',
    unionNameBn: 'ইউনিয়ন এ',
    availableSurveys: ['RS', 'BS'],
    estimatedKhatians: 100,
    estimatedDags: 200,
    mapSheets: [1],
  }));
}

test('batchMouzasForQueue splits 23 unique Mouzas into 7 + 7 + 7 + 2 batches and deduplicates duplicate IDs', () => {
  const base23 = makeSyntheticMouzas(23);
  const withDuplicates = [...base23, base23[0], base23[10], base23[22]];
  const batches = batchMouzasForQueue(withDuplicates, 7);

  assert.equal(batches.length, 4);
  assert.deepEqual(
    batches.map((b) => b.length),
    [7, 7, 7, 2]
  );
  const flattenedIds = batches.flat().map((m) => m.id);
  assert.equal(new Set(flattenedIds).size, 23);
});

test('buildBatchedQueueTasks assigns batch metadata, avoids mixing Upazilas, and handles empty selection', () => {
  const div = GEO_HIERARCHY[0];
  const dist = div.districts[0];
  const upz1 = dist.upazilas[0];
  const upz2 = { ...dist.upazilas[0], id: 'upz-other', nameEn: 'Kasba', eporchaSlug: 'kasba' };

  const mouzas23 = makeSyntheticMouzas(23);
  const batchedTasks = buildBatchedQueueTasks({
    division: div,
    district: dist,
    upazila: upz1,
    mouzas: mouzas23,
    endpoints: ['mouza-vittik-khatian'],
    surveys: ['RS'],
    bookStyle: { layout: 'new', colorMode: 'color' },
    batchSize: 7,
  });

  assert.equal(batchedTasks.length, 23);
  assert.equal(batchedTasks[0].batchIndex, 1);
  assert.equal(batchedTasks[0].batchTotal, 4);
  assert.equal(batchedTasks[0].batchSize, 7);
  assert.equal(batchedTasks[22].batchIndex, 4);
  assert.equal(batchedTasks[22].batchTotal, 4);
  assert.equal(batchedTasks[22].batchSize, 2);

  // Separate Upazila calls stay strictly scoped to their own Upazila
  const tasksUpz2 = buildBatchedQueueTasks({
    division: div,
    district: dist,
    upazila: upz2,
    mouzas: makeSyntheticMouzas(3, 'kasba'),
    endpoints: ['mouza-vittik-khatian'],
    surveys: ['RS'],
    bookStyle: { layout: 'new', colorMode: 'color' },
  });
  assert.ok(tasksUpz2.every((t) => t.upazilaNameEn === 'Kasba'));
  assert.ok(batchedTasks.every((t) => t.upazilaNameEn === upz1.nameEn));

  // No selected Mouzas -> 0 tasks
  const emptySelection = buildUnifiedQueueForDocumentSelection({
    division: div,
    district: dist,
    upazila: upz1,
    allMouzasForUpazila: upz1.mouzas,
    currentSelectedMouzaIds: [],
    endpoints: ALL_ENDPOINT_TYPES,
    surveys: ALL_SURVEY_TYPES,
    bookStyle: { layout: 'new', colorMode: 'color' },
  });
  assert.equal(emptySelection.tasks.length, 0);
});

test('mergeQueueTasksPreservingProgress is idempotent and preserves completed tasks across re-selection', () => {
  const sample = makeSampleTasks();
  sample[0].status = 'CACHED_INDEXEDDB';
  sample[0].pdfVerified = true;
  sample[0].sha256 = 'abc123';

  const reBuilt = makeSampleTasks();
  const merged1 = mergeQueueTasksPreservingProgress(sample, reBuilt);
  const merged2 = mergeQueueTasksPreservingProgress(merged1, reBuilt);

  assert.equal(merged1.length, sample.length);
  assert.equal(merged2.length, sample.length);
  assert.equal(merged2[0].status, 'CACHED_INDEXEDDB');
  assert.equal(merged2[0].sha256, 'abc123');
  assert.equal(new Set(merged2.map((t) => t.id)).size, merged2.length);
});

test('recoverStaleQueueTasks resets interrupted FETCHING_EPORCHA_TECH tasks and cancellation skips completed tasks', () => {
  const sample = makeSampleTasks();
  sample[0].status = 'CACHED_INDEXEDDB';
  sample[1].status = 'FETCHING_EPORCHA_TECH';
  sample[2].status = 'QUEUED';

  const recovered = recoverStaleQueueTasks(sample);
  assert.equal(recovered[0].status, 'CACHED_INDEXEDDB');
  assert.equal(recovered[1].status, 'QUEUED');
  assert.match(recovered[1].errorMessage || '', /Recovered/i);

  const singleCancelled = cancelQueueTask(recovered, recovered[1].id);
  assert.equal(singleCancelled[1].status, 'CANCELLED');
  assert.equal(singleCancelled[0].status, 'CACHED_INDEXEDDB');

  const allCancelled = cancelAllPendingTasks(singleCancelled);
  assert.equal(allCancelled[0].status, 'CACHED_INDEXEDDB');
  assert.equal(allCancelled[2].status, 'CANCELLED');
  assert.equal(allCancelled[3].status, 'CANCELLED');
});

test('buildQueueTasksForUpazila auto-selects 100% of Mouzas for any Upazila', () => {
  const div = GEO_HIERARCHY[0];
  const dist = div.districts[0];
  const upz = dist.upazilas[0];

  const result = buildQueueTasksForUpazila({
    division: div,
    district: dist,
    upazila: upz,
    endpoints: ['mouza-vittik-khatian'],
    surveys: ['RS', 'BS'],
    bookStyle: { layout: 'new', colorMode: 'color' },
  });

  assert.equal(result.allMouzas.length, upz.mouzas.length);
  assert.equal(result.selectedMouzaIds.length, upz.mouzas.length);
  assert.equal(result.tasks.length, upz.mouzas.length * 2);
});

test('reorderQueueTasks reorders drag-and-drop rows without clearing or resetting statuses', () => {
  const sample = makeSampleTasks();
  sample[0].status = 'CACHED_INDEXEDDB';
  sample[0].pdfVerified = true;
  sample[0].byteLength = 4096;

  // Drag task at index 3 to index 1
  const reordered = reorderQueueTasks(sample, sample[3].id, sample[1].id);

  assert.equal(reordered.length, 4);
  assert.equal(reordered[0].id, sample[0].id);
  assert.equal(reordered[0].status, 'CACHED_INDEXEDDB');
  assert.equal(reordered[0].pdfVerified, true);
  assert.equal(reordered[1].id, sample[3].id);
  assert.equal(reordered[2].id, sample[1].id);
  assert.equal(reordered[3].id, sample[2].id);
});

test('moveQueueTaskByOffset supports UP, DOWN, and TOP priority moves while preserving completed tasks', () => {
  const sample = makeSampleTasks();
  sample[0].status = 'CACHED_INDEXEDDB';

  // Move last task to TOP of QUEUED tasks (index 1, right after completed index 0)
  const movedTop = moveQueueTaskByOffset(sample, sample[3].id, 'TOP');
  assert.equal(movedTop[0].id, sample[0].id);
  assert.equal(movedTop[1].id, sample[3].id);

  // Move index 2 UP to index 1
  const movedUp = moveQueueTaskByOffset(sample, sample[2].id, 'UP');
  assert.equal(movedUp[1].id, sample[2].id);
  assert.equal(movedUp[2].id, sample[1].id);

  // Move index 1 DOWN to index 2
  const movedDown = moveQueueTaskByOffset(sample, sample[1].id, 'DOWN');
  assert.equal(movedDown[1].id, sample[2].id);
  assert.equal(movedDown[2].id, sample[1].id);
});

test('prioritizeMouzaInQueue moves all tasks for a chosen Mouza to the front of pending queue without clearing', () => {
  const sample = makeSampleTasks();
  sample[0].status = 'HTML_INDEX_EXTRACTED';
  const targetMouzaId = sample[3].mouzaId;

  const prioritized = prioritizeMouzaInQueue(sample, targetMouzaId);
  assert.equal(prioritized.length, sample.length);
  // Completed task stays at index 0
  assert.equal(prioritized[0].id, sample[0].id);
  assert.equal(prioritized[0].status, 'HTML_INDEX_EXTRACTED');
  // Prioritized Mouza is now first in the pending queue (index 1)
  assert.equal(prioritized[1].mouzaId, targetMouzaId);
});

test('calculateQueueProgress and calculatePoliteJitterDelay compute accurate metrics', () => {
  const metrics = calculateQueueProgress([
    { status: 'CACHED_INDEXEDDB', pdfVerified: true },
    { status: 'HTML_INDEX_EXTRACTED', pdfVerified: false },
    { status: 'QUEUED' },
    { status: 'QUEUED' },
  ]);
  assert.equal(metrics.totalCount, 4);
  assert.equal(metrics.completedCount, 2);
  assert.equal(metrics.queuedCount, 2);
  assert.equal(metrics.verifiedPdfCount, 1);
  assert.equal(metrics.percentage, 50);

  const jitter = calculatePoliteJitterDelay(450, 900, 3);
  assert.ok(jitter >= 450 && jitter <= 900);
});

test('evaluateTaskSizeIntegrity cross-references downloaded PDF size against document-type average to flag partial or corrupted downloads', () => {
  const sample = makeSampleTasks();
  sample[0].status = 'CACHED_INDEXEDDB';
  sample[0].byteLength = 60 * 1024;
  sample[0].pdfVerified = true;

  sample[1].status = 'CACHED_INDEXEDDB';
  sample[1].byteLength = 64 * 1024;
  sample[1].pdfVerified = true;

  sample[2].status = 'CACHED_INDEXEDDB';
  sample[2].byteLength = 32 * 1024;
  sample[2].pdfVerified = true;

  sample[3].status = 'CACHED_INDEXEDDB';
  sample[3].byteLength = 12 * 1024;
  sample[3].pdfVerified = false;

  const stats = computeDocumentTypeSizeStats(sample);
  assert.equal(stats['mouza-vittik-khatian'].usingBaseline, false);
  assert.equal(stats['mouza-vittik-khatian'].sampleCount, 4);

  const check0 = evaluateTaskSizeIntegrity(sample[0], stats);
  assert.equal(check0.status, 'INTEGRITY_VERIFIED');

  const partialCheck = evaluateTaskSizeIntegrity(
    {
      endpointType: 'mouza-vittik-khatian',
      byteLength: 25 * 1024,
      status: 'CACHED_INDEXEDDB',
      pdfVerified: true,
    },
    stats
  );
  assert.equal(partialCheck.status, 'PARTIAL_SUSPECT');

  const check3 = evaluateTaskSizeIntegrity(sample[3], stats);
  assert.equal(check3.status, 'CORRUPTED_OR_TRUNCATED');

  const pendingCheck = evaluateTaskSizeIntegrity(
    {
      endpointType: 'mouza-vittik-khatian',
      byteLength: undefined,
      status: 'QUEUED',
      pdfVerified: false,
    },
    stats
  );
  assert.equal(pendingCheck.status, 'PENDING');
});

test('computeQueueIntegrityHealthReport and requeueIntegrityFlaggedTasks summarize Mouza and Document-Type throttling anomalies', () => {
  const sample = makeSampleTasks();
  sample[0].status = 'CACHED_INDEXEDDB';
  sample[0].byteLength = 62 * 1024;
  sample[0].pdfVerified = true;

  sample[1].status = 'CACHED_INDEXEDDB';
  sample[1].byteLength = 60 * 1024;
  sample[1].pdfVerified = true;

  // Task 2: partial suspect (~52% of 43.5 KB cohort avg)
  sample[2].status = 'CACHED_INDEXEDDB';
  sample[2].byteLength = 24 * 1024;
  sample[2].pdfVerified = true;

  // Task 3: truncated (<45% of cohort avg)
  sample[3].status = 'CACHED_INDEXEDDB';
  sample[3].byteLength = 10 * 1024;
  sample[3].pdfVerified = false;

  const report = computeQueueIntegrityHealthReport(sample);
  assert.equal(report.totalTasks, 4);
  assert.equal(report.downloadedCount, 4);
  assert.equal(report.verifiedCount, 2);
  assert.equal(report.partialSuspectCount, 1);
  assert.equal(report.corruptedCount, 1);
  assert.equal(report.flaggedCount, 2);
  assert.equal(report.throttlingRiskLevel, 'HIGH_THROTTLING_DETECTED');

  // Top Mouza in report.byMouza should be one of the flagged Mouzas
  assert.ok(report.byMouza[0].flaggedCount > 0);

  // Re-queue flagged tasks
  const { updatedTasks, requeuedCount } = requeueIntegrityFlaggedTasks(sample);
  assert.equal(requeuedCount, 2);
  assert.equal(updatedTasks[2].status, 'QUEUED');
  assert.equal(updatedTasks[3].status, 'QUEUED');
});
