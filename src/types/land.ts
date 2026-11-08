export type EporchaEndpointType =
  | 'mouza-vittik-khatian'
  | 'mouza-vittik-dag'
  | 'survey-khatian'
  | 'namjari-khatian'
  | 'mouza-map'
  | 'khatian-index';

export type EporchaDocType =
  | 'MOUZA_KHATIAN_BOOK'
  | 'MOUZA_DAG_BOOK'
  | 'SURVEY_KHATIAN'
  | 'NAMJARI_KHATIAN'
  | 'MOUZA_MAP'
  | 'KHATIAN_INDEX';

export type SurveyType = 'CS' | 'SA' | 'RS' | 'BS' | 'MUTATION';

export interface BookStyleConfig {
  layout: 'new' | 'old';
  colorMode: 'color' | 'bw';
}

export interface MouzaNode {
  id: string;
  jlNo: string;
  nameEn: string;
  nameBn: string;
  unionNameEn: string;
  unionNameBn: string;
  availableSurveys: SurveyType[];
  estimatedKhatians: number;
  estimatedDags: number;
  mapSheets: number[];
}

export interface UpazilaNode {
  id: string;
  nameEn: string;
  nameBn: string;
  eporchaSlug: string;
  mouzas: MouzaNode[];
}

export interface DistrictNode {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
  eporchaSlug: string;
  upazilas: UpazilaNode[];
}

export interface DivisionNode {
  id: string;
  nameEn: string;
  nameBn: string;
  eporchaSlug: string;
  districts: DistrictNode[];
}

export type TaskStatus =
  | 'QUEUED'
  | 'FETCHING_EPORCHA_TECH'
  | 'MAGIC_BYTE_VERIFIED'
  | 'CACHED_INDEXEDDB'
  | 'HTML_INDEX_EXTRACTED'
  | 'CORS_BRIDGE_REQUIRED'
  | 'NOT_AVAILABLE_ON_EPORCHA_TECH'
  | 'FAILED_RETRY'
  | 'PERMANENT_FAILURE'
  | 'PAUSED'
  | 'CANCELLED';

export type TransportMode =
  | 'CAPACITOR_NATIVE_HTTP'
  | 'SERVER_EXPRESS_RELAY'
  | 'TERMUX_LOCAL_PROXY'
  | 'CLOUDFLARE_WORKER_PROXY'
  | 'SCRAPFLY'
  | 'DIRECT_BROWSER_FETCH';

export interface QueueTask {
  id: string;
  endpointType: EporchaEndpointType;
  docType: EporchaDocType;
  divisionNameEn: string;
  districtNameEn: string;
  districtNameBn: string;
  upazilaNameEn: string;
  upazilaNameBn: string;
  unionNameEn: string;
  unionNameBn: string;
  mouzaId: string;
  mouzaJlNo: string;
  mouzaNameEn: string;
  mouzaNameBn: string;
  surveyType: SurveyType;
  bookStyle?: BookStyleConfig;
  khatianNo?: string;
  mapSheetNo?: number;
  fileName: string;
  targetUrl: string;
  status: TaskStatus;
  httpStatus?: number;
  latencyMs?: number;
  byteLength?: number;
  magicBytesHex?: string;
  pdfVerified: boolean;
  extractedRowCount?: number;
  transportUsed?: TransportMode;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
}

export interface BinaryValidationResult {
  isValidPdf: boolean;
  byteLength: number;
  magicBytesHex: string;
  isHtmlPayload: boolean;
  isJsonPayload: boolean;
  extractedRecords: KhatianRecord[];
  diagnosticReason: string;
}

export interface KhatianRecord {
  recordId: string;
  districtName: string;
  upazilaName: string;
  unionName: string;
  mouzaNameEn: string;
  mouzaNameBn: string;
  mouzaJlNo: string;
  surveyType: SurveyType;
  khatianNo: string;
  ownerName: string;
  dagNo: string;
  totalLandAcres: string;
  sourceUrl: string;
  extractedAt: string;
}

export interface VerifiedBlobRecord {
  taskId: string;
  fileName: string;
  mimeType: string;
  isPdfVerified: boolean;
  byteLength: number;
  magicHex: string;
  buffer: ArrayBuffer;
  targetUrl: string;
  verifiedAt: string;
}

export type ConcurrencyTier = 1 | 2 | 3 | 7;

export interface ProxyConfig {
  preferredMode: TransportMode;
  termuxProxyUrl: string;
  customCloudflareProxyUrl: string;
  concurrency: ConcurrencyTier;
  minDelayMs: number;
  maxDelayMs: number;
  autoTuneConcurrency?: boolean;
}

export interface ConcurrencyTunerTelemetry {
  autoTuneEnabled: boolean;
  currentConcurrency: ConcurrencyTier;
  rollingLatencyMs: number;
  lastLatencyMs: number;
  sampleCount: number;
  consecutiveFastCount: number;
  consecutiveSlowOrTimeoutCount: number;
  totalScaleUps: number;
  totalBackoffs: number;
  lastAdjustmentReason: string;
  regime: 'TURBO_7X' | 'FAST_3X' | 'BALANCED_2X' | 'SAFE_BACKOFF_1X';
}

export type SchedulerTimezoneMode = 'BD_STANDARD' | 'LOCAL_SYSTEM';

export interface SmartSchedulerConfig {
  enabled: boolean;
  startTime: string; // "HH:mm" e.g. "02:00"
  endTime: string;   // "HH:mm" e.g. "06:00"
  timezoneMode: SchedulerTimezoneMode;
  autoPauseOutsideWindow: boolean;
  autoRetryFailedOnWindowStart: boolean;
}

export interface WorkWindowEvaluation {
  isWithinWindow: boolean;
  currentTimeHHMM: string;
  currentTime12h: string;
  windowLabel12h: string;
  minutesUntilStart: number;
  minutesUntilEnd: number;
  countdownText: string;
  portalTrafficEstimate: 'OFF_PEAK_OPTIMAL' | 'MODERATE_TRAFFIC' | 'PEAK_PORTAL_LOAD';
}

export type SmartPauseActionMode = 'AUTO_SUSPEND_AND_NOTIFY' | 'NOTIFY_ONLY';

export type SmartPauseTriggerReason =
  | 'CONSECUTIVE_TIMEOUTS'
  | 'SUSTAINED_LATENCY_SPIKE'
  | null;

export interface SmartPauseConfig {
  enabled: boolean;
  actionMode: SmartPauseActionMode;
  consecutiveTimeoutsThreshold: number;
  sustainedLatencyThresholdMs: number;
  sustainedDurationMinutes: number;
  maxTaskRetryBudget: number;
}

export interface SmartPauseMonitorState {
  consecutiveTimeouts: number;
  highLatencyStartedAtMs: number | null;
  sustainedHighLatencyElapsedMs: number;
  isTriggered: boolean;
  triggerReason: SmartPauseTriggerReason;
  triggerMessage: string | null;
  triggeredAtIso: string | null;
  queueAutoSuspended: boolean;
}

export interface GithubReleaseAssetInfo {
  checkedAt: string;
  repoFullName: string;
  releaseFound: boolean;
  tagName: string;
  releaseName: string;
  publishedAt: string;
  apkAssetFound: boolean;
  apkFileName: string;
  apkDownloadUrl: string;
  apkSizeBytes: number;
  apkContentType: string;
  htmlReleaseUrl: string;
  statusMessage: string;
}


