import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import {
  GITHUB_ACTIONS_APK_WORKFLOW_YAML,
  REPO_CONFIG,
} from '../config/repoConfig';
import {
  ApkReleaseCheckResult,
  fetchLatestApkRelease,
  getSavedRepoSlug,
  saveRepoSlug,
  triggerVerifiedApkDownload,
} from '../services/apkReleaseService';
import { isCapacitorNativeRuntime } from '../services/eporchaTechClient';

interface ApkInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TERMUX_RELAY_ONELINER = `pkg install nodejs -y && node -e 'const http=require("http");http.createServer(async(q,s)=>{s.setHeader("Access-Control-Allow-Origin","*");const u=new URL(q.url,"http://localhost").searchParams.get("url");if(!u||!u.startsWith("https://eporcha.tech"))return s.writeHead(400).end("Invalid eporcha.tech URL");try{const r=await fetch(u,{headers:{"User-Agent":"Mozilla/5.0","Referer":"https://eporcha.tech/"}});const b=Buffer.from(await r.arrayBuffer());s.writeHead(r.status,{"Content-Type":r.headers.get("content-type")||"application/octet-stream","X-Upstream-Status":String(r.status)});s.end(b);}catch(e){s.writeHead(502).end(String(e));}}).listen(8787,()=>console.log("LRgetBD Pro Termux Relay active on http://127.0.0.1:8787/proxy?url="));'`;

export const ApkInstallerModal: React.FC<ApkInstallerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [repoSlugInput, setRepoSlugInput] = useState<string>(() =>
    getSavedRepoSlug()
  );
  const [loading, setLoading] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ApkReleaseCheckResult | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadStatusMsg, setDownloadStatusMsg] = useState<string | null>(
    null
  );

  const runReleaseCheck = async (slugToUse?: string) => {
    const normalizedSlug = saveRepoSlug(slugToUse ?? repoSlugInput);
    setRepoSlugInput(normalizedSlug);
    setLoading(true);
    setDownloadStatusMsg(null);
    try {
      const result = await fetchLatestApkRelease(normalizedSlug);
      setReleaseInfo(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const initialSlug = getSavedRepoSlug();
      setRepoSlugInput(initialSlug);
      runReleaseCheck(initialSlug);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleResetDefaultRepo = () => {
    setRepoSlugInput(REPO_CONFIG.fullSlug);
    runReleaseCheck(REPO_CONFIG.fullSlug);
  };

  const handleDownloadVerifiedApk = async () => {
    setLoading(true);
    setDownloadStatusMsg(null);
    try {
      const latest = await fetchLatestApkRelease(repoSlugInput);
      setReleaseInfo(latest);

      if (latest.verified && latest.status === 'VERIFIED_READY') {
        const triggered = triggerVerifiedApkDownload(latest);
        if (triggered) {
          setDownloadStatusMsg(
            `Downloading verified binary ${latest.assetName} (${latest.sizeMb}) from ${latest.browserDownloadUrl}...`
          );
        }
      } else {
        setDownloadStatusMsg(
          `Download prevented: No verified .apk asset (> 1 MB) found on ${latest.repoSlug} yet. Run ${REPO_CONFIG.workflowFilePath} in GitHub Actions first.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const nativeActive = isCapacitorNativeRuntime();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2
                id="apk-modal-title"
                className="text-base font-semibold text-white"
              >
                {REPO_CONFIG.appName} — Official Android APK Release Engine
              </h2>
              <p className="text-xs text-slate-400 font-mono-tabular">
                Package ID: {REPO_CONFIG.appId} · Asset:{' '}
                {REPO_CONFIG.standardApkFilename}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close APK installer modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Runtime Environment Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-400">
                Active Runtime Environment
              </div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {nativeActive
                    ? 'Capacitor Native Android APK (100% CORS-Free Direct eporcha.tech)'
                    : 'Web Browser + Built-in Express Server Relay (/api/eporcha-proxy)'}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Repo Switcher (Zero Discrepancy Safeguard) */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="github-repo-slug-input"
                className="text-xs font-semibold text-slate-200 flex items-center gap-1.5"
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                <span>Target GitHub Repository Slug (owner/repo)</span>
              </label>
              {repoSlugInput !== REPO_CONFIG.fullSlug && (
                <button
                  type="button"
                  onClick={handleResetDefaultRepo}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
                >
                  Reset to {REPO_CONFIG.fullSlug}
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="github-repo-slug-input"
                type="text"
                value={repoSlugInput}
                onChange={(e) => setRepoSlugInput(e.target.value)}
                placeholder="tapos-linx/LRgetBD-Pro"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => runReleaseCheck(repoSlugInput)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                />
                <span>Re-Check Release Status</span>
              </button>
            </div>

            <div className="text-[11px] font-mono-tabular text-slate-400 break-all space-y-0.5">
              <div>
                API: {releaseInfo?.apiEndpoint || REPO_CONFIG.releasesApiEndpoint}
              </div>
              <div>
                Direct Asset URL:{' '}
                {releaseInfo?.directFallbackAssetUrl ||
                  REPO_CONFIG.directFallbackAssetUrl}
              </div>
            </div>
          </div>

          {/* Live Release Verification Result Card */}
          {releaseInfo?.verified && releaseInfo.status === 'VERIFIED_READY' ? (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>VERIFIED ANDROID APK READY (&gt; 1 MB)</span>
                </span>
                <span className="text-xs font-mono-tabular text-emerald-400">
                  Downloads: {releaseInfo.downloadCount}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs border-t border-emerald-500/20">
                <div>
                  <div className="text-slate-400">Tag Name</div>
                  <div className="font-mono-tabular font-semibold text-white mt-0.5">
                    {releaseInfo.tagName}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Asset Filename</div>
                  <div className="font-mono-tabular font-semibold text-emerald-300 truncate mt-0.5">
                    {releaseInfo.assetName}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Verified Size</div>
                  <div className="font-mono-tabular font-semibold text-white mt-0.5">
                    {releaseInfo.sizeMb}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Published At</div>
                  <div className="font-mono-tabular text-slate-300 mt-0.5">
                    {releaseInfo.publishedAt}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                {releaseInfo.message}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadVerifiedApk}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Download Android APK ({releaseInfo.assetName})
                  </span>
                </button>

                <a
                  href={releaseInfo.releasesPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Releases Page</span>
                </a>
              </div>
            </div>
          ) : (
            /* Graceful "First Build Pending" State */
            <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-xs font-semibold text-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>⏳ Waiting for First GitHub Actions APK Build</span>
                </span>
                <span className="text-xs font-mono-tabular text-amber-400">
                  HTTP {releaseInfo?.httpStatus || 404} · Zero-Corrupt-APK Guard
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {releaseInfo?.message ||
                  `Checking https://api.github.com/repos/${repoSlugInput}/releases/latest for ${REPO_CONFIG.standardApkFilename}...`}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-amber-500/20">
                <div>
                  <div className="text-slate-400">Repository</div>
                  <div className="font-mono-tabular font-semibold text-white truncate mt-0.5">
                    {releaseInfo?.repoSlug || repoSlugInput}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Expected Asset</div>
                  <div className="font-mono-tabular font-semibold text-amber-300 truncate mt-0.5">
                    {REPO_CONFIG.standardApkFilename}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Min Binary Gate</div>
                  <div className="font-mono-tabular text-slate-300 mt-0.5">
                    &gt; 1.00 MB (1,048,576 B)
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Package ID</div>
                  <div className="font-mono-tabular text-slate-300 truncate mt-0.5">
                    {REPO_CONFIG.appId}
                  </div>
                </div>
              </div>

              {/* 3 Direct Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <a
                  href={
                    releaseInfo?.actionsUrl ||
                    REPO_CONFIG.actionsUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open GitHub Actions Tab</span>
                </a>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(GITHUB_ACTIONS_APK_WORKFLOW_YAML, 'workflow-yaml')
                  }
                  className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'workflow-yaml' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied {REPO_CONFIG.workflowFilePath}!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy {REPO_CONFIG.workflowFilePath}</span>
                    </>
                  )}
                </button>

                <a
                  href={
                    releaseInfo?.releasesPageUrl ||
                    REPO_CONFIG.releasesPageUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Releases Page</span>
                </a>
              </div>
            </div>
          )}

          {downloadStatusMsg && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 font-mono-tabular">
              {downloadStatusMsg}
            </div>
          )}

          {/* Embedded Self-Healing GitHub Actions Workflow Preview & Copy */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                1. Self-Healing GitHub Actions Workflow (
                <code>{REPO_CONFIG.workflowFilePath}</code>)
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    GITHUB_ACTIONS_APK_WORKFLOW_YAML,
                    'workflow-yaml-box'
                  )
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedKey === 'workflow-yaml-box' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Workflow YAML</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full YAML</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono-tabular text-slate-300 max-h-48 overflow-y-auto overflow-x-auto">
              {GITHUB_ACTIONS_APK_WORKFLOW_YAML}
            </pre>
          </div>

          {/* Local Termux Relay One-Liner for Mobile Web Browsers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-200">
                  2. Optional Android Termux Local Relay (127.0.0.1:8787)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(TERMUX_RELAY_ONELINER, 'termux')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedKey === 'termux' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Termux Command</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono-tabular text-amber-200/90 overflow-x-auto">
              {TERMUX_RELAY_ONELINER}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Zero-Corrupt-APK Policy: Never downloads HTML 404 pages or unverified binaries.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
