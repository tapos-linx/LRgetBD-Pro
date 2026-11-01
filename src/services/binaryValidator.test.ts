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
  GEO_HIERARCHY,
} from '../data/geoHierarchy';
import {
  buildQueueTasksForUpazila,
  calculatePoliteJitterDelay,
  generateManifestAuditCsv,
} from './queueEngine';

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

test('validates authentic %PDF- binary header exceeding 1024 bytes', () => {
  const bytes = new Uint8Array(2048);
  // %PDF-1.7
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

  const dagBookName = buildForensicFileName({
    districtNameEn: 'Brahmanbaria',
    upazilaNameEn: 'Nabinagar',
    mouzaJlNo: '115',
    mouzaNameEn: 'Kaitala',
    surveyType: 'BS',
    endpointType: 'mouza-vittik-dag',
  });
  assert.equal(dagBookName, 'Brahmanbaria_Nabinagar_JL-115_Kaitala_BS_DAG_BOOK_full.pdf');

  const nabinagar = GEO_HIERARCHY[0].districts[0].upazilas[0];
  assert.equal(nabinagar.nameEn, 'Nabinagar');
  assert.equal(nabinagar.mouzas.length, 24);

  const goalai = nabinagar.mouzas.find((m) => m.jlNo === '114');
  assert.ok(goalai);
  const url = buildEporchaTargetUrl({
    endpointType: 'mouza-vittik-khatian',
    divisionSlug: 'chattogram',
    districtSlug: 'brahmanbaria',
    upazilaSlug: 'nabinagar',
    mouza: goalai,
    surveyType: 'RS',
    bookStyle: { layout: 'new', colorMode: 'color' },
  });
  assert.match(url, /^https:\/\/eporcha\.tech\/mouza-vittik-khatian\?/);
  assert.match(url, /mouza_jl=114/);
  assert.match(url, /format=new/);
  assert.match(url, /color=color/);
});

test('cascading districts populate upazilas and Select All generates full multi-endpoint queue', () => {
  const chittagongDiv = GEO_HIERARCHY[0];
  assert.ok(chittagongDiv.districts.length >= 6);

  const cumillaDist = chittagongDiv.districts.find((d) => d.id === 'dist-cumilla');
  assert.ok(cumillaDist);
  assert.equal(cumillaDist.upazilas.length, 8);

  const debidwar = cumillaDist.upazilas.find((u) => u.id === 'upz-debidwar');
  assert.ok(debidwar);
  assert.equal(debidwar.mouzas.length, 4);

  // When Select All is clicked: all 5 endpoints + all 5 surveys for all mouzas in Debidwar
  // Each mouza gets: 4 endpoints * 5 surveys (20) + 1 namjari-khatian * 1 MUTATION survey (1) = 21 tasks per mouza
  const allTasks = generateTasksForMouzasAndEndpoints({
    divisionNameEn: chittagongDiv.nameEn,
    divisionSlug: chittagongDiv.eporchaSlug,
    districtNameEn: cumillaDist.nameEn,
    districtNameBn: cumillaDist.nameBn,
    districtSlug: cumillaDist.eporchaSlug,
    upazilaNameEn: debidwar.nameEn,
    upazilaNameBn: debidwar.nameBn,
    upazilaSlug: debidwar.eporchaSlug,
    mouzas: debidwar.mouzas,
    endpoints: ALL_ENDPOINT_TYPES,
    surveys: ALL_SURVEY_TYPES,
    bookStyle: { layout: 'new', colorMode: 'color' },
  });

  assert.equal(allTasks.length, debidwar.mouzas.length * 21);
});

test('calculates polite jitter delay within 600ms-1200ms bounds and formats CSV audit', () => {
  for (let i = 0; i < 10; i++) {
    const delay = calculatePoliteJitterDelay(600, 1200, i);
    assert.ok(delay >= 600 && delay <= 1200);
  }

  const csv = generateManifestAuditCsv([]);
  assert.match(csv, /Task_ID,Forensic_FileName,Endpoint_Mode/);
});

test('buildQueueTasksForUpazila selects 100% of available Mouzas and builds task list automatically', () => {
  const chittagongDiv = GEO_HIERARCHY[0];
  const brahmanbariaDist = chittagongDiv.districts[0];
  const kasbaUpz = brahmanbariaDist.upazilas.find((u) => u.id === 'upz-kasba');
  assert.ok(kasbaUpz);

  const result = buildQueueTasksForUpazila({
    division: chittagongDiv,
    district: brahmanbariaDist,
    upazila: kasbaUpz,
    endpoints: ['mouza-vittik-khatian', 'mouza-vittik-dag'],
    surveys: ['RS', 'BS'],
    bookStyle: { layout: 'new', colorMode: 'color' },
  });

  // 100% of available Mouzas in Kasba must be selected
  assert.equal(result.allMouzas.length, kasbaUpz.mouzas.length);
  assert.equal(result.selectedMouzaIds.length, kasbaUpz.mouzas.length);
  assert.deepEqual(
    result.selectedMouzaIds,
    kasbaUpz.mouzas.map((m) => m.id)
  );

  // 5 Mouzas * 2 endpoints * 2 surveys = 20 queue tasks built automatically
  assert.equal(result.tasks.length, kasbaUpz.mouzas.length * 4);
  assert.ok(result.tasks.every((t) => t.upazilaNameEn === 'Kasba'));
});

test('verifies official LR_Mass_Downloader repoConfig coordinates and APK release inspector', async () => {
  const { REPO_CONFIG, buildRepoEndpoints } = await import('../config/repoConfig');
  const { inspectGithubReleasePayload } = await import('./apkReleaseService');

  assert.equal(REPO_CONFIG.owner, 'tapos-linx');
  assert.equal(REPO_CONFIG.repo, 'LR_Mass_Downloader');
  assert.equal(REPO_CONFIG.fullSlug, 'tapos-linx/LR_Mass_Downloader');
  assert.equal(REPO_CONFIG.appName, 'LRgetBD Pro');
  assert.equal(REPO_CONFIG.appId, 'bd.landarchive.lrgetbdpro');
  assert.equal(REPO_CONFIG.standardApkFilename, 'LRgetBD-Pro.apk');
  assert.equal(
    REPO_CONFIG.releasesApiEndpoint,
    'https://api.github.com/repos/tapos-linx/LR_Mass_Downloader/releases/latest'
  );
  assert.equal(
    REPO_CONFIG.directFallbackAssetUrl,
    'https://github.com/tapos-linx/LR_Mass_Downloader/releases/latest/download/LRgetBD-Pro.apk'
  );

  const pending404 = inspectGithubReleasePayload(404, null, 'tapos-linx/LR_Mass_Downloader');
  assert.equal(pending404.status, 'FIRST_BUILD_PENDING');
  assert.equal(pending404.verified, false);

  const corruptSmallApk = inspectGithubReleasePayload(
    200,
    {
      tag_name: 'v1.0.1',
      assets: [
        {
          name: 'LRgetBD-Pro.apk',
          size: 50000, // < 1MB should be rejected!
          browser_download_url:
            'https://github.com/tapos-linx/LR_Mass_Downloader/releases/download/v1.0.1/LRgetBD-Pro.apk',
        },
      ],
    },
    'tapos-linx/LR_Mass_Downloader'
  );
  assert.equal(corruptSmallApk.verified, false);
  assert.equal(corruptSmallApk.status, 'ASSET_MISSING_OR_INVALID');

  const validApk = inspectGithubReleasePayload(
    200,
    {
      tag_name: 'v1.0.12',
      published_at: '2026-11-01T10:00:00Z',
      assets: [
        {
          name: 'LRgetBD-Pro.apk',
          size: 4500000,
          download_count: 14,
          browser_download_url:
            'https://github.com/tapos-linx/LR_Mass_Downloader/releases/download/v1.0.12/LRgetBD-Pro.apk',
        },
      ],
    },
    'tapos-linx/LR_Mass_Downloader'
  );
  assert.equal(validApk.verified, true);
  assert.equal(validApk.status, 'VERIFIED_READY');
  assert.equal(validApk.assetName, 'LRgetBD-Pro.apk');
  assert.equal(validApk.tagName, 'v1.0.12');
  assert.equal(validApk.sizeMb, '4.29 MB');
  assert.equal(validApk.downloadCount, 14);

  const customEndpoints = buildRepoEndpoints('custom-org/Custom-LRgetBD');
  assert.equal(
    customEndpoints.releasesApiEndpoint,
    'https://api.github.com/repos/custom-org/Custom-LRgetBD/releases/latest'
  );
});

test('buildUnifiedQueueForDocumentSelection explicitly populates all Mouza IDs when empty and builds unified task list', async () => {
  const { buildUnifiedQueueForDocumentSelection } = await import('./queueEngine');
  const chittagongDiv = GEO_HIERARCHY[0];
  const brahmanbariaDist = chittagongDiv.districts[0];
  const nabinagarUpz = brahmanbariaDist.upazilas[0];

  // When currentSelectedMouzaIds is empty ([]), it must explicitly select 100% of available Mouzas for Nabinagar (24)
  const unified = buildUnifiedQueueForDocumentSelection({
    division: chittagongDiv,
    district: brahmanbariaDist,
    upazila: nabinagarUpz,
    allMouzasForUpazila: nabinagarUpz.mouzas,
    currentSelectedMouzaIds: [],
    endpoints: [...ALL_ENDPOINT_TYPES],
    surveys: [...ALL_SURVEY_TYPES],
    bookStyle: { layout: 'new', colorMode: 'color' },
  });

  assert.equal(unified.selectedMouzaIds.length, nabinagarUpz.mouzas.length);
  assert.equal(unified.selectedMouzas.length, 24);
  // 24 Mouzas * 21 tasks per Mouza across all 5 endpoints and 5 surveys = 504 tasks
  assert.equal(unified.tasks.length, 24 * 21);
});



