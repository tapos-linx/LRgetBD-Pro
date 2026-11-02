import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQueueTasksForUpazila,
  calculatePoliteJitterDelay,
  calculateQueueProgress,
  computeDocumentTypeSizeStats,
  computeQueueIntegrityHealthReport,
  evaluateTaskSizeIntegrity,
  moveQueueTaskByOffset,
  prioritizeMouzaInQueue,
  reorderQueueTasks,
  requeueIntegrityFlaggedTasks,
} from './queueEngine';
import { GEO_HIERARCHY } from '../data/geoHierarchy';
import { QueueTask } from '../types/land';

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


