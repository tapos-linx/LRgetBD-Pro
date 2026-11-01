export type EporchaEndpointType =
  | 'survey-khatian'
  | 'namjari-khatian'
  | 'mouza-vittik-khatian'
  | 'mouza-vittik-dag'
  | 'mouza-map';

export type EporchaDocType =
  | 'SURVEY_KHATIAN'
  | 'NAMJARI_KHATIAN'
  | 'MOUZA_KHATIAN_BOOK'
  | 'MOUZA_DAG_BOOK'
  | 'MOUZA_MAP';

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
  | 'PAUSED'
  | 'CANCELLED';

export type TransportMode =
  | 'CAPACITOR_NATIVE_HTTP'
  | 'SERVER_EXPRESS_RELAY'
  | 'TERMUX_LOCAL_PROXY'
  | 'CLOUDFLARE_WORKER_PROXY'
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

export interface ProxyConfig {
  preferredMode: TransportMode;
  termuxProxyUrl: string;
  customCloudflareProxyUrl: string;
  concurrency: 1 | 2 | 3;
  minDelayMs: number;
  maxDelayMs: number;
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
