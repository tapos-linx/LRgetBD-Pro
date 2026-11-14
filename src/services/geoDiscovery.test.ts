import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geoDiscovery } from './geoDiscoveryService';
import { geoDb } from './geographicDbService';
import { batchMouzasForQueue, evaluateWorkWindowStatus, createInitialConcurrencyTelemetry, evaluateAutoConcurrencyStep, computeLatencyTrendWindow, createInitialSmartPauseState, evaluateSmartPauseStep, applyTaskRetryBudgetPolicy, retryFailedTasks } from './queueEngine';
import { MouzaNode, SmartSchedulerConfig, ProxyConfig, QueueTask, SmartPauseConfig } from '../types/land';

// Mock the global fetch
global.fetch = vi.fn();

// Mock geographicDbService
vi.mock('./geographicDbService', () => ({
  geoDb: {
    saveDistrict: vi.fn(),
    saveUpazila: vi.fn(),
    saveMouzas: vi.fn(),
    getDistricts: vi.fn().mockResolvedValue([]),
    getUpazilas: vi.fn().mockResolvedValue([]),
    getMouzas: vi.fn().mockResolvedValue([]),
    logRejection: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('Phase 4-7: Nationwide Geographic Discovery & Batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Scenario 1: Should discover districts from eporcha.tech and persist to Firestore', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: '1', name_en: 'Dhaka', name_bn: 'ঢাকা' },
        { id: '2', name_en: 'Gazipur', name_bn: 'গাজীপুর' }
      ])
    });

    const districts = await geoDiscovery.discoverDistricts('div-dhaka');
    
    expect(districts).toHaveLength(2);
    expect(districts[0].nameEn).toBe('Dhaka');
    expect(geoDb.saveDistrict).toHaveBeenCalledTimes(2);
  });

  it('Scenario 4: Should discover ALL Mouzas for Nabinagar (176 expected) without truncation', async () => {
    // Simulate a large response for Nabinagar
    const mockMouzas = Array.from({ length: 176 }, (_, i) => ({
      jl_no: String(i + 1),
      name_en: `Mouza ${i + 1}`,
      name_bn: `মৌজা ${i + 1}`,
      union_en: 'Union A',
      union_bn: 'ইউনিয়ন এ'
    }));

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMouzas)
    });

    const mouzas = await geoDiscovery.discoverMouzas('upz-nabinagar');
    
    expect(mouzas).toHaveLength(176);
    expect(mouzas[175].jlNo).toBe('176');
    expect(geoDb.saveMouzas).toHaveBeenCalledWith(expect.arrayContaining([expect.anything()]), 'upz-nabinagar');
  });

  it('Scenario 6: Should implement exactly seven-mouza batching for the download queue', () => {
    const mockMouzas: MouzaNode[] = Array.from({ length: 15 }, (_, i) => ({
      id: `mz-${i}`,
      jlNo: String(i + 1),
      nameEn: `Mouza ${i}`,
      nameBn: `মৌজা ${i}`,
      unionNameEn: 'Union',
      unionNameBn: 'ইউনিয়ন',
      availableSurveys: ['RS'],
      estimatedKhatians: 100,
      estimatedDags: 200,
      mapSheets: [1]
    }));

    const batches = batchMouzasForQueue(mockMouzas, 7);
    
    expect(batches).toHaveLength(3); // 7 + 7 + 1
    expect(batches[0]).toHaveLength(7);
    expect(batches[1]).toHaveLength(7);
    expect(batches[2]).toHaveLength(1);
    expect(batches[0][0].id).toBe('mz-0');
    expect(batches[1][0].id).toBe('mz-7');
  });

  it('Scenario 7: Should handle duplicate Mouza records gracefully during discovery', async () => {
    const duplicateData = [
      { jl_no: '10', name_en: 'Duplicate', name_bn: 'ডুপ্লিকেট' },
      { jl_no: '10', name_en: 'Duplicate', name_bn: 'ডুপ্লিকেট' }
    ];

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(duplicateData)
    });

    const mouzas = await geoDiscovery.discoverMouzas('upz-test');
    
    expect(mouzas).toHaveLength(1);
  });

  it('Scenario 8: Should evaluate Smart Batch Scheduler 2 AM - 6 AM work window accurately', () => {
    const config: SmartSchedulerConfig = {
      enabled: true,
      startTime: '02:00',
      endTime: '06:00',
      timezoneMode: 'BD_STANDARD',
      autoPauseOutsideWindow: true,
      autoRetryFailedOnWindowStart: true,
    };

    // 03:30 AM BST (which is 21:30 UTC the previous day)
    const insideBstDate = new Date('2026-11-04T21:30:00Z');
    const insideEval = evaluateWorkWindowStatus(config, insideBstDate);
    expect(insideEval.isWithinWindow).toBe(true);
    expect(insideEval.minutesUntilEnd).toBe(150); // 2h 30m left until 06:00
    expect(insideEval.portalTrafficEstimate).toBe('OFF_PEAK_OPTIMAL');

    // 14:00 PM BST (which is 08:00 UTC)
    const outsideBstDate = new Date('2026-11-05T08:00:00Z');
    const outsideEval = evaluateWorkWindowStatus(config, outsideBstDate);
    expect(outsideEval.isWithinWindow).toBe(false);
    expect(outsideEval.minutesUntilStart).toBe(12 * 60); // 12 hours until 2:00 AM next day
    expect(outsideEval.portalTrafficEstimate).toBe('PEAK_PORTAL_LOAD');
  });

  it('Scenario 9: Should dynamically tune concurrency up on fast latency and back off on timeouts', () => {
    let config: ProxyConfig = {
      preferredMode: 'SERVER_EXPRESS_RELAY',
      termuxProxyUrl: 'http://127.0.0.1:8080/proxy',
      customCloudflareProxyUrl: '',
      concurrency: 3,
      minDelayMs: 120,
      maxDelayMs: 280,
      autoTuneConcurrency: true,
    };
    let telemetry = createInitialConcurrencyTelemetry(config);

    // 2 consecutive fast responses (240ms and 210ms) should scale concurrency from 3 -> 7 (TURBO_7X)
    const step1 = evaluateAutoConcurrencyStep({
      currentConfig: config,
      telemetry,
      sample: { latencyMs: 240, httpStatus: 200, timedOut: false },
    });
    config = step1.nextConfig;
    telemetry = step1.nextTelemetry;
    expect(config.concurrency).toBe(3);

    const step2 = evaluateAutoConcurrencyStep({
      currentConfig: config,
      telemetry,
      sample: { latencyMs: 210, httpStatus: 200, timedOut: false },
    });
    config = step2.nextConfig;
    telemetry = step2.nextTelemetry;
    expect(step2.changed).toBe(true);
    expect(config.concurrency).toBe(7);
    expect(telemetry.regime).toBe('TURBO_7X');
    expect(telemetry.totalScaleUps).toBe(1);

    // Hard timeout (timedOut: true, HTTP 0) should immediately back off from 7 -> 2
    const step3 = evaluateAutoConcurrencyStep({
      currentConfig: config,
      telemetry,
      sample: { latencyMs: 8005, httpStatus: 0, timedOut: true },
    });
    config = step3.nextConfig;
    telemetry = step3.nextTelemetry;
    expect(step3.changed).toBe(true);
    expect(config.concurrency).toBe(2);
    expect(telemetry.regime).toBe('BALANCED_2X');
    expect(telemetry.totalBackoffs).toBe(1);
  });

  it('Scenario 10: Should compute Average Fetch Latency (ms) window over the last 50 tasks for D3 chart', () => {
    const mockTasks: QueueTask[] = Array.from({ length: 65 }, (_, idx) => ({
      id: `task-${idx + 1}`,
      endpointType: 'mouza-vittik-khatian',
      docType: 'MOUZA_KHATIAN_BOOK',
      divisionNameEn: 'Chattogram',
      districtNameEn: 'Brahmanbaria',
      districtNameBn: 'ব্রাহ্মণবাড়িয়া',
      upazilaNameEn: 'Nabinagar',
      upazilaNameBn: 'নবীনগর',
      unionNameEn: 'Nabinagar',
      unionNameBn: 'নবীনগর',
      mouzaId: `mz-${idx + 1}`,
      mouzaJlNo: String(idx + 1),
      mouzaNameEn: `Mouza ${idx + 1}`,
      mouzaNameBn: `মৌজা ${idx + 1}`,
      surveyType: 'RS',
      fileName: `mouza_${idx + 1}.pdf`,
      targetUrl: `https://eporcha.tech/mouza/${idx + 1}`,
      status: 'CACHED_INDEXEDDB',
      httpStatus: 200,
      // Latency improves from 900ms down to 300ms across the 65 tasks
      latencyMs: Math.max(250, 900 - idx * 8),
      pdfVerified: true,
      createdAt: new Date(1700000000000 + idx * 1000).toISOString(),
      updatedAt: new Date(1700000000000 + idx * 1000).toISOString(),
      retryCount: 0,
    }));

    const window50 = computeLatencyTrendWindow(mockTasks, 50);
    expect(window50.points).toHaveLength(50);
    expect(window50.points[0].taskId).toBe('task-16'); // Last 50 of 65 (tasks 16..65)
    expect(window50.points[49].taskId).toBe('task-65');
    expect(window50.points[49].sequenceIndex).toBe(50);
    expect(window50.overallAverageMs).toBeGreaterThan(0);
    expect(window50.trendDirection).toBe('IMPROVING');
  });

  it('Scenario 11: Should trigger Smart Pause on 3 consecutive timeouts or >3000ms spike exceeding 5 minutes', () => {
    const config: SmartPauseConfig = {
      enabled: true,
      actionMode: 'AUTO_SUSPEND_AND_NOTIFY',
      consecutiveTimeoutsThreshold: 3,
      sustainedLatencyThresholdMs: 3000,
      sustainedDurationMinutes: 5,
      maxTaskRetryBudget: 3,
    };

    // Part A: 3 consecutive timeouts trigger CONSECUTIVE_TIMEOUTS
    let stateA = createInitialSmartPauseState();
    stateA = evaluateSmartPauseStep({
      config,
      currentState: stateA,
      sample: { latencyMs: 8000, httpStatus: 0, timedOut: true, timestampMs: 1000 },
    }).nextState;
    expect(stateA.consecutiveTimeouts).toBe(1);
    expect(stateA.isTriggered).toBe(false);

    stateA = evaluateSmartPauseStep({
      config,
      currentState: stateA,
      sample: { latencyMs: 8000, httpStatus: 504, timedOut: true, timestampMs: 2000 },
    }).nextState;
    expect(stateA.consecutiveTimeouts).toBe(2);
    expect(stateA.isTriggered).toBe(false);

    const stepA3 = evaluateSmartPauseStep({
      config,
      currentState: stateA,
      sample: { latencyMs: 8000, httpStatus: 0, timedOut: true, timestampMs: 3000 },
    });
    expect(stepA3.newlyTriggered).toBe(true);
    expect(stepA3.shouldSuspendQueue).toBe(true);
    expect(stepA3.nextState.isTriggered).toBe(true);
    expect(stepA3.nextState.triggerReason).toBe('CONSECUTIVE_TIMEOUTS');

    // Part B: Sustained latency spike > 3000ms for more than 5 minutes (> 300,000ms)
    let stateB = createInitialSmartPauseState();
    const startTs = 1_700_000_000_000;
    stateB = evaluateSmartPauseStep({
      config,
      currentState: stateB,
      sample: { latencyMs: 3450, httpStatus: 200, timedOut: false, timestampMs: startTs },
    }).nextState;
    expect(stateB.isTriggered).toBe(false);

    // At +4m 30s (270,000ms): still under 5 minutes
    stateB = evaluateSmartPauseStep({
      config,
      currentState: stateB,
      sample: { latencyMs: 3600, httpStatus: 200, timedOut: false, timestampMs: startTs + 270_000 },
    }).nextState;
    expect(stateB.isTriggered).toBe(false);

    // At +5m 05s (305,000ms): exceeds 5 minutes -> triggers SUSTAINED_LATENCY_SPIKE
    const stepB3 = evaluateSmartPauseStep({
      config,
      currentState: stateB,
      sample: { latencyMs: 3800, httpStatus: 200, timedOut: false, timestampMs: startTs + 305_000 },
    });
    expect(stepB3.newlyTriggered).toBe(true);
    expect(stepB3.shouldSuspendQueue).toBe(true);
    expect(stepB3.nextState.isTriggered).toBe(true);
    expect(stepB3.nextState.triggerReason).toBe('SUSTAINED_LATENCY_SPIKE');
  });

  it('Scenario 12: Should enforce per-task retry budget for transient 5xx failures and flag permanent 4xx immediately', () => {
    const transientFailedTask: QueueTask = {
      id: 'task-transient-503',
      endpointType: 'mouza-vittik-khatian',
      docType: 'MOUZA_KHATIAN_BOOK',
      divisionNameEn: 'Chattogram',
      districtNameEn: 'Brahmanbaria',
      districtNameBn: 'ব্রাহ্মণবাড়িয়া',
      upazilaNameEn: 'Nabinagar',
      upazilaNameBn: 'নবীনগর',
      unionNameEn: 'Nabinagar',
      unionNameBn: 'নবীনগর',
      mouzaId: 'mz-1',
      mouzaJlNo: '1',
      mouzaNameEn: 'Nabinagar',
      mouzaNameBn: 'নবীনগর',
      surveyType: 'RS',
      fileName: 'transient_503.pdf',
      targetUrl: 'https://eporcha.tech/transient-503',
      status: 'FAILED_RETRY',
      httpStatus: 503,
      pdfVerified: false,
      errorMessage: 'HTTP 503 Service Unavailable from eporcha.tech',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
    };

    // Failure #1 (retryCount 0 -> 1 of 3): auto-requeued as QUEUED
    const attempt1 = applyTaskRetryBudgetPolicy(transientFailedTask, 3);
    expect(attempt1.autoRequeued).toBe(true);
    expect(attempt1.flaggedPermanentFailure).toBe(false);
    expect(attempt1.nextTask.status).toBe('QUEUED');
    expect(attempt1.nextTask.retryCount).toBe(1);

    // Failure #2 (retryCount 1 -> 2 of 3): auto-requeued as QUEUED
    const attempt2 = applyTaskRetryBudgetPolicy(
      { ...attempt1.nextTask, status: 'FAILED_RETRY', httpStatus: 503 },
      3
    );
    expect(attempt2.autoRequeued).toBe(true);
    expect(attempt2.flaggedPermanentFailure).toBe(false);
    expect(attempt2.nextTask.status).toBe('QUEUED');
    expect(attempt2.nextTask.retryCount).toBe(2);

    // Failure #3 (retryCount 2 -> 3 of 3): budget exhausted -> flagged PERMANENT_FAILURE
    const attempt3 = applyTaskRetryBudgetPolicy(
      { ...attempt2.nextTask, status: 'FAILED_RETRY', httpStatus: 503 },
      3
    );
    expect(attempt3.autoRequeued).toBe(false);
    expect(attempt3.flaggedPermanentFailure).toBe(true);
    expect(attempt3.nextTask.status).toBe('PERMANENT_FAILURE');
    expect(attempt3.nextTask.retryCount).toBe(3);

    // Permanent HTTP 404/403 should fail immediately on first attempt without exhausting retry cycles
    const permanent404Task: QueueTask = {
      ...transientFailedTask,
      id: 'task-dead-link',
      status: 'NOT_AVAILABLE_ON_EPORCHA_TECH',
      httpStatus: 404,
      errorMessage: 'HTTP 404 Not Found',
    };
    const permOutcome = applyTaskRetryBudgetPolicy(permanent404Task, 3);
    expect(permOutcome.autoRequeued).toBe(false);
    expect(permOutcome.flaggedPermanentFailure).toBe(true);
    expect(permOutcome.nextTask.status).toBe('PERMANENT_FAILURE');

    // Calling retryFailedTasks must NOT re-queue PERMANENT_FAILURE tasks
    const retryBatch = retryFailedTasks([attempt3.nextTask, permOutcome.nextTask], 3);
    expect(retryBatch.retriedCount).toBe(0);
    expect(retryBatch.updatedTasks[0].status).toBe('PERMANENT_FAILURE');
    expect(retryBatch.updatedTasks[1].status).toBe('PERMANENT_FAILURE');
  });

  it('Scenario 11: Should query eporcha.tech URL for Upazila Mouzas, report the found count, and auto-select all discovered Mouzas', async () => {
    const mockKasbaData = {
      success: true,
      status_code: 200,
      message: 'Fetch Successfully',
      data: Array.from({ length: 150 }, (_, i) => ({
        ID: 300000 + i,
        MOUZA_ID: 50000 + i,
        MOUZA_NAME: `মৌজা ${i + 1}`,
        UUID: `uuid-${i + 1}`,
        JL_NUMBER: String(i + 1),
        SURVEY_NAME_EN: `Mouza ${i + 1}`,
        UPAZILA_NAME: 'কসবা',
      })),
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockKasbaData),
    });

    const summary = await geoDiscovery.queryMouzasFromPortalUrl('upz-kasba', 'dist-brahmanbaria');

    expect(summary.totalFound).toBe(150);
    expect(summary.mouzas).toHaveLength(150);
    expect(summary.portalUrl).toContain('DISTRICT_BBS_CODE=12');
    expect(summary.portalUrl).toContain('UPAZILA_BBS_CODE=63');

    // Verify all 150 Mouzas have proper structure and zero capping
    expect(summary.mouzas[0].jlNo).toBe('1');
    expect(summary.mouzas[149].jlNo).toBe('150');
  });

  it('Scenario 12: Should query eporcha.tech URL for District Upazilas, report total found Upazilas, and return all of them for the cascading menu', async () => {
    const mockCumillaUpazilas = {
      success: true,
      status_code: 200,
      message: 'Fetch Successfully',
      data: Array.from({ length: 17 }, (_, i) => ({
        ID: 120000 + i,
        NAME: `উপজেলা ${i + 1}`,
        NAME_EN: `UPAZILA ${i + 1}`,
        BBS_CODE: String(i + 1).padStart(2, '0'),
        DISTRICT_BBS_CODE: '19',
      })),
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCumillaUpazilas),
    });

    const summary = await geoDiscovery.queryUpazilasFromPortalUrl('dist-cumilla');

    expect(summary.totalFound).toBe(17);
    expect(summary.upazilas).toHaveLength(17);
    expect(summary.upazilas[0].nameEn).toBe('Upazila 1');
    expect(summary.upazilas[16].nameEn).toBe('Upazila 17');
    expect(summary.sourceStatus).toBe('LIVE_SOURCE');
    expect(summary.isLive).toBe(true);
  });

  it('Scenario 13: Rejects HTML login pages, empty bodies, and HTTP failures cleanly without faking live success', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<!DOCTYPE html><html><body>Login Required</body></html>'),
    });

    const htmlSummary = await geoDiscovery.queryMouzasFromPortalUrl('upz-kasba', 'dist-brahmanbaria');
    expect(htmlSummary.isLive).toBe(false);
    expect(htmlSummary.sourceStatus).toBe('FAILED');
    expect(htmlSummary.totalFound).toBe(0);
    expect(htmlSummary.errorMessage).toMatch(/HTML/i);

    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('   '),
    });

    const emptySummary = await geoDiscovery.queryMouzasFromPortalUrl('upz-kasba', 'dist-brahmanbaria');
    expect(emptySummary.isLive).toBe(false);
    expect(emptySummary.sourceStatus).toBe('FAILED');
    expect(emptySummary.errorMessage).toMatch(/Empty/i);

    (fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const httpErrSummary = await geoDiscovery.queryMouzasFromPortalUrl('upz-kasba', 'dist-brahmanbaria');
    expect(httpErrSummary.isLive).toBe(false);
    expect(httpErrSummary.sourceStatus).toBe('FAILED');
    expect(httpErrSummary.errorMessage).toMatch(/500/);
  });

  it('Scenario 14: Enforces strict parent-district match and handles duplicate/colliding codes safely', async () => {
    // Attempt to query a Dhaka Upazila while constrained to Brahmanbaria district must NOT return wrong district data
    const wrongParentSummary = await geoDiscovery.queryMouzasFromPortalUrl(
      'upz-savar',
      'dist-brahmanbaria'
    );
    expect(wrongParentSummary.isLive).toBe(false);
    expect(wrongParentSummary.totalFound).toBe(0);
    expect(wrongParentSummary.sourceStatus).toBe('NOT_FOUND');

    // Duplicate Upazila codes returned by upstream JSON are deduplicated cleanly
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { ID: 101, NAME: 'কসবা', NAME_EN: 'KASBA', BBS_CODE: '63', DISTRICT_BBS_CODE: '12' },
            { ID: 101, NAME: 'কসবা', NAME_EN: 'KASBA', BBS_CODE: '63', DISTRICT_BBS_CODE: '12' },
          ],
        }),
    });

    const dedupedUpazilas = await geoDiscovery.queryUpazilasFromPortalUrl('dist-brahmanbaria');
    expect(dedupedUpazilas.upazilas).toHaveLength(1);
    expect(dedupedUpazilas.sourceStatus).toBe('LIVE_SOURCE');
  });
});




