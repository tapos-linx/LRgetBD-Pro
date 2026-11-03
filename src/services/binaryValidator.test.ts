import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bytesToHex,
  hasPdfMagicSignature,
  inspectBinaryPayload,
  ValidationContext,
} from './binaryValidator';
import {
  ALL_ENDPOINT_TYPES,
  ALL_SURVEY_TYPES,
  buildEporchaTargetUrl,
  buildForensicFileName,
  generateTasksForMouzasAndEndpoints,
} from '../data/geoHierarchy';
import {
  buildQueueTasksForUpazila,
  calculatePoliteJitterDelay,
  calculateQueueProgress,
  generateManifestAuditCsv,
} from './queueEngine';
import { DivisionNode, DistrictNode, UpazilaNode, MouzaNode } from '../types/land';

const sampleContext: ValidationContext = {
  districtName: 'Brahmanbaria',
  upazilaName: 'Nabinagar',
  unionName: '20-No Kaitala South Union',
  mouzaNameEn: 'Goalai',
  mouzaNameBn: 'গোয়ালী',
  mouzaJlNo: '114',
  surveyType: 'RS',
  sourceUrl: 'https://eporcha.tech/mouza-vittik-khatian?mouza_jl=114',
};

// Mock data for hierarchy tests
const mockMouza: MouzaNode = {
  id: 'mz-114',
  jlNo: '114',
  nameEn: 'Goalai',
  nameBn: 'গোয়ালী',
  unionNameEn: 'Union',
  unionNameBn: 'ইউনিয়ন',
  availableSurveys: ['RS'],
  estimatedKhatians: 100,
  estimatedDags: 200,
  mapSheets: [1]
};

const mockUpazila: UpazilaNode = {
  id: 'upz-nabinagar',
  nameEn: 'Nabinagar',
  nameBn: 'নবীনগর',
  eporchaSlug: 'nabinagar',
  mouzas: [mockMouza]
};

const mockDistrict: DistrictNode = {
  id: 'dist-brahmanbaria',
  code: '12',
  nameEn: 'Brahmanbaria',
  nameBn: 'ব্রাহ্মণবাড়িয়া',
  eporchaSlug: 'brahmanbaria',
  upazilas: [mockUpazila]
};

const mockDivision: DivisionNode = {
  id: 'div-chattogram',
  nameEn: 'Chattogram',
  nameBn: 'চট্টগ্রাম',
  eporchaSlug: 'chattogram',
  districts: [mockDistrict]
};

test('validates authentic %PDF- binary header exceeding 1024 bytes', () => {
  const bytes = new Uint8Array(2048);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 0);
  assert.equal(hasPdfMagicSignature(bytes), true);
  assert.equal(bytesToHex(bytes, 5), '25 50 44 46 2D');

  const result = inspectBinaryPayload(bytes.buffer, sampleContext);
  assert.equal(result.isValidPdf, true);
  assert.equal(result.byteLength, 2048);
  assert.equal(result.magicBytesHex, '25 50 44 46 2D');
});

test('rejects truncated %PDF- buffer smaller than or equal to 1024 bytes', () => {
  const bytes = new Uint8Array(512);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);

  const result = inspectBinaryPayload(bytes.buffer, sampleContext);
  assert.equal(result.isValidPdf, false);
  assert.match(result.diagnosticReason, /Rejected truncated PDF/);
});

test('rejects HTML page masquerading as PDF and extracts HTML Khatian table rows', () => {
  const html = `<!DOCTYPE html>
  <html>
    <head><title>eporcha.tech - Survey Khatian</title></head>
    <body>
      <table>
        <tr><td>খতিয়ান নম্বর</td><td>মালিক/দলিলধারী</td><td>দাগ নম্বর</td><td>মোট জমি</td></tr>
        <tr><td>101</td><td>আব্দুল করিম ওং</td><td>1420, 1421</td><td>1.45</td></tr>
        <tr><td>102</td><td>মোঃ রফিকুল ইসলাম</td><td>1425</td><td>0.82</td></tr>
      </table>
    </body>
  </html>`;
  const buffer = new TextEncoder().encode(html).buffer;
  const result = inspectBinaryPayload(buffer, sampleContext);

  assert.equal(result.isValidPdf, false);
  assert.equal(result.isHtmlPayload, true);
  assert.equal(result.extractedRecords.length, 2);
  assert.equal(result.extractedRecords[0].khatianNo, '101');
  assert.equal(result.extractedRecords[0].ownerName, 'আব্দুল করিম ওং');
  assert.equal(result.extractedRecords[0].dagNo, '1420, 1421');
  assert.equal(result.extractedRecords[0].totalLandAcres, '1.45');
});

test('builds standardized forensic filenames and eporcha.tech target URLs', () => {
  const khatianBookName = buildForensicFileName({
    districtNameEn: 'Brahmanbaria',
    upazilaNameEn: 'Nabinagar',
    mouzaJlNo: '114',
    mouzaNameEn: 'Goalai',
    surveyType: 'RS',
    endpointType: 'mouza-vittik-khatian',
    bookStyle: { layout: 'new', colorMode: 'color' },
  });
  assert.equal(
    khatianBookName,
    'Brahmanbaria_Nabinagar_JL-114_Goalai_RS_KHATIAN_BOOK_new-color.pdf'
  );

  const url = buildEporchaTargetUrl({
    endpointType: 'mouza-vittik-khatian',
    divisionSlug: 'chattogram',
    districtSlug: 'brahmanbaria',
    upazilaSlug: 'nabinagar',
    mouza: mockMouza,
    surveyType: 'RS',
    bookStyle: { layout: 'new', colorMode: 'color' },
  });
  assert.match(url, /^https:\/\/eporcha\.tech\/mouza-vittik-khatian\?/);
  assert.match(url, /mouza_jl=114/);
});

test('generateTasksForMouzasAndEndpoints builds full multi-endpoint queue', () => {
  const allTasks = generateTasksForMouzasAndEndpoints({
    divisionNameEn: mockDivision.nameEn,
    divisionSlug: mockDivision.eporchaSlug,
    districtNameEn: mockDistrict.nameEn,
    districtNameBn: mockDistrict.nameBn,
    districtSlug: mockDistrict.eporchaSlug,
    upazilaNameEn: mockUpazila.nameEn,
    upazilaNameBn: mockUpazila.nameBn,
    upazilaSlug: mockUpazila.eporchaSlug,
    mouzas: mockUpazila.mouzas,
    endpoints: ALL_ENDPOINT_TYPES,
    surveys: ALL_SURVEY_TYPES,
    bookStyle: { layout: 'new', colorMode: 'color' },
  });

  // 1 mouza * 26 tasks (5 endpoints * 5 surveys + 1 namjari * 1 mutation)
  assert.equal(allTasks.length, 26);
});

test('calculates polite jitter delay within bounds and formats CSV audit', () => {
  for (let i = 0; i < 10; i++) {
    const delay = calculatePoliteJitterDelay(600, 1200, i);
    assert.ok(delay >= 600 && delay <= 1200);
  }

  const csv = generateManifestAuditCsv([]);
  assert.match(csv, /Task_ID,Forensic_FileName,Endpoint_Mode/);
});

test('buildQueueTasksForUpazila selects 100% of available Mouzas and builds task list automatically', () => {
  const result = buildQueueTasksForUpazila({
    division: mockDivision,
    district: mockDistrict,
    upazila: mockUpazila,
    endpoints: ['mouza-vittik-khatian', 'mouza-vittik-dag'],
    surveys: ['RS', 'BS'],
    bookStyle: { layout: 'new', colorMode: 'color' },
  });

  assert.equal(result.allMouzas.length, mockUpazila.mouzas.length);
  assert.equal(result.selectedMouzaIds.length, mockUpazila.mouzas.length);
  assert.equal(result.tasks.length, mockUpazila.mouzas.length * 4);
});

test('verifies official repoConfig coordinates', async () => {
  const { REPO_CONFIG } = await import('../config/repoConfig');

  assert.equal(REPO_CONFIG.owner, 'tapos-linx');
  assert.equal(REPO_CONFIG.repo, 'LRgetBD-Pro');
  assert.equal(REPO_CONFIG.appName, 'LRgetBD Pro');
  assert.equal(REPO_CONFIG.appId, 'bd.landarchive.lrgetbdpro');
});

test('calculateQueueProgress accurately computes completion percentage and status counts', () => {
  const emptyProgress = calculateQueueProgress([]);
  assert.equal(emptyProgress.totalCount, 0);

  const tasks = [
    { status: 'CACHED_INDEXEDDB', pdfVerified: true },
    { status: 'HTML_INDEX_EXTRACTED', pdfVerified: false },
    { status: 'QUEUED', pdfVerified: false },
    { status: 'FAILED_RETRY', pdfVerified: false },
  ];
  const progress = calculateQueueProgress(tasks);
  assert.equal(progress.totalCount, 4);
  assert.equal(progress.completedCount, 2);
  assert.equal(progress.percentage, 50);
});
