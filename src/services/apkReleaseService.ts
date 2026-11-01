import { buildRepoEndpoints, REPO_CONFIG } from '../config/repoConfig';

export interface GithubReleaseAssetRaw {
  name?: string;
  size?: number;
  browser_download_url?: string;
  download_count?: number;
  content_type?: string;
}

export interface GithubReleaseRaw {
  tag_name?: string;
  name?: string;
  published_at?: string;
  html_url?: string;
  assets?: GithubReleaseAssetRaw[];
}

export type ApkReleaseVerificationStatus =
  | 'VERIFIED_READY'
  | 'FIRST_BUILD_PENDING'
  | 'ASSET_MISSING_OR_INVALID'
  | 'NETWORK_ERROR';

export interface ApkReleaseCheckResult {
  status: ApkReleaseVerificationStatus;
  httpStatus: number;
  repoSlug: string;
  apiEndpoint: string;
  actionsUrl: string;
  releasesPageUrl: string;
  directFallbackAssetUrl: string;
  verified: boolean;
  tagName: string;
  releaseTitle: string;
  assetName: string;
  browserDownloadUrl: string;
  sizeBytes: number;
  sizeMb: string;
  publishedAt: string;
  downloadCount: number;
  checkedAt: string;
  message: string;
}

export function getSavedRepoSlug(): string {
  try {
    const saved = localStorage.getItem(REPO_CONFIG.repoStorageKey);
    if (saved && saved.trim().includes('/')) {
      return buildRepoEndpoints(saved).fullSlug;
    }
  } catch {
    // Ignore storage access errors
  }
  return REPO_CONFIG.fullSlug;
}

export function saveRepoSlug(slug: string): string {
  const normalized = buildRepoEndpoints(slug).fullSlug;
  try {
    localStorage.setItem(REPO_CONFIG.repoStorageKey, normalized);
  } catch {
    // Ignore storage access errors
  }
  return normalized;
}

export function formatReleasePublishedAt(isoString?: string): string {
  if (!isoString) return 'Pending First Release';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function inspectGithubReleasePayload(
  httpStatus: number,
  data: GithubReleaseRaw | null,
  repoSlug: string = REPO_CONFIG.fullSlug
): ApkReleaseCheckResult {
  const endpoints = buildRepoEndpoints(repoSlug);
  const nowIso = new Date().toISOString();

  if (httpStatus === 404 || !data) {
    return {
      status: httpStatus === 404 ? 'FIRST_BUILD_PENDING' : 'NETWORK_ERROR',
      httpStatus,
      repoSlug: endpoints.fullSlug,
      apiEndpoint: endpoints.releasesApiEndpoint,
      actionsUrl: endpoints.actionsUrl,
      releasesPageUrl: endpoints.releasesPageUrl,
      directFallbackAssetUrl: endpoints.directFallbackAssetUrl,
      verified: false,
      tagName: 'Pending First Release',
      releaseTitle: 'Waiting for First GitHub Actions APK Build',
      assetName: REPO_CONFIG.standardApkFilename,
      browserDownloadUrl: '',
      sizeBytes: 0,
      sizeMb: '0.00 MB',
      publishedAt: 'Waiting for CI Run',
      downloadCount: 0,
      checkedAt: nowIso,
      message:
        httpStatus === 404
          ? `No published release found yet on ${endpoints.fullSlug} (HTTP 404). Push or dispatch ${REPO_CONFIG.workflowFilePath} in GitHub Actions to automatically compile and publish ${REPO_CONFIG.standardApkFilename}.`
          : `Unable to reach GitHub Releases API for ${endpoints.fullSlug} (HTTP ${httpStatus}).`,
    };
  }

  const assets = Array.isArray(data.assets) ? data.assets : [];

  // Prioritize LRgetBD-Pro.apk with size > 1048576 (1 MB), else any .apk with size > 1048576
  const validApkAssets = assets.filter(
    (a) =>
      typeof a.name === 'string' &&
      a.name.toLowerCase().endsWith('.apk') &&
      typeof a.size === 'number' &&
      a.size > REPO_CONFIG.minValidApkSizeBytes &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.startsWith('https://')
  );

  const prioritizedAsset =
    validApkAssets.find(
      (a) => a.name?.toLowerCase() === REPO_CONFIG.standardApkFilename.toLowerCase()
    ) || validApkAssets[0];

  if (!prioritizedAsset) {
    return {
      status: 'ASSET_MISSING_OR_INVALID',
      httpStatus,
      repoSlug: endpoints.fullSlug,
      apiEndpoint: endpoints.releasesApiEndpoint,
      actionsUrl: endpoints.actionsUrl,
      releasesPageUrl: endpoints.releasesPageUrl,
      directFallbackAssetUrl: endpoints.directFallbackAssetUrl,
      verified: false,
      tagName: data.tag_name || 'v1.0.0',
      releaseTitle: data.name || data.tag_name || 'Release Found (No Valid APK > 1MB)',
      assetName: REPO_CONFIG.standardApkFilename,
      browserDownloadUrl: '',
      sizeBytes: 0,
      sizeMb: '0.00 MB',
      publishedAt: formatReleasePublishedAt(data.published_at),
      downloadCount: 0,
      checkedAt: nowIso,
      message: `Release ${data.tag_name || ''} exists on ${endpoints.fullSlug}, but no valid .apk binary (> 1 MB) is attached yet. Wait for the GitHub Actions workflow to finish uploading ${REPO_CONFIG.standardApkFilename}.`,
    };
  }

  const sizeBytes = prioritizedAsset.size || 0;
  const sizeMb = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  const assetName = prioritizedAsset.name || REPO_CONFIG.standardApkFilename;
  const browserDownloadUrl =
    prioritizedAsset.browser_download_url || endpoints.directFallbackAssetUrl;
  const downloadCount = prioritizedAsset.download_count ?? 0;

  return {
    status: 'VERIFIED_READY',
    httpStatus,
    repoSlug: endpoints.fullSlug,
    apiEndpoint: endpoints.releasesApiEndpoint,
    actionsUrl: endpoints.actionsUrl,
    releasesPageUrl: endpoints.releasesPageUrl,
    directFallbackAssetUrl: endpoints.directFallbackAssetUrl,
    verified: true,
    tagName: data.tag_name || 'v1.0.0',
    releaseTitle: data.name || data.tag_name || 'Production Android APK Release',
    assetName,
    browserDownloadUrl,
    sizeBytes,
    sizeMb,
    publishedAt: formatReleasePublishedAt(data.published_at),
    downloadCount,
    checkedAt: nowIso,
    message: `Verified authentic Android APK binary (${assetName}, ${sizeMb}) on ${endpoints.fullSlug} Releases.`,
  };
}

/**
 * Live GitHub Releases API Inspector.
 * Queries https://api.github.com/repos/${owner}/${repo}/releases/latest with
 * Accept: application/vnd.github+json.
 */
export async function fetchLatestApkRelease(
  customRepoSlug?: string
): Promise<ApkReleaseCheckResult> {
  const targetSlug = buildRepoEndpoints(customRepoSlug || getSavedRepoSlug()).fullSlug;
  const endpoints = buildRepoEndpoints(targetSlug);

  // First try server-side inspector route (which sends Accept: application/vnd.github+json to api.github.com)
  try {
    const proxyRes = await fetch(
      `/api/github-release-check?repo=${encodeURIComponent(targetSlug)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    if (proxyRes.ok) {
      const payload = await proxyRes.json();
      if (typeof payload.status === 'number') {
        return inspectGithubReleasePayload(
          payload.status,
          payload.data || null,
          targetSlug
        );
      }
    }
  } catch {
    // Fall back to direct GitHub API query below
  }

  try {
    const response = await fetch(endpoints.releasesApiEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as GithubReleaseRaw;
      return inspectGithubReleasePayload(response.status, data, targetSlug);
    }

    return inspectGithubReleasePayload(response.status, null, targetSlug);
  } catch (error) {
    const fallback = inspectGithubReleasePayload(0, null, targetSlug);
    return {
      ...fallback,
      status: 'NETWORK_ERROR',
      message:
        error instanceof Error
          ? `Network error querying ${endpoints.releasesApiEndpoint}: ${error.message}`
          : `Network error querying ${endpoints.releasesApiEndpoint}`,
    };
  }
}

/**
 * Pre-Flight Verification & Direct Binary Download Trigger.
 * Never generates a synthetic Blob in JavaScript and never downloads if the release does not exist yet.
 * Triggers a native browser/Android download via an invisible <a> element pointing to the verified
 * browser_download_url or https://github.com/tapos-linx/LRgetBD-Pro/releases/latest/download/LRgetBD-Pro.apk.
 */
export function triggerVerifiedApkDownload(release: ApkReleaseCheckResult): boolean {
  if (
    !release.verified ||
    release.status !== 'VERIFIED_READY' ||
    release.sizeBytes <= REPO_CONFIG.minValidApkSizeBytes ||
    !release.browserDownloadUrl
  ) {
    return false;
  }

  const anchor = document.createElement('a');
  anchor.href = release.browserDownloadUrl;
  anchor.download = release.assetName || REPO_CONFIG.standardApkFilename;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    if (anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
  }, 250);

  return true;
}
