import React, { useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  ExternalLink,
  FileEdit,
  FileSpreadsheet,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { ProxyConfig, QueueTask, TransportMode } from '../types/land';

interface QueueConsoleViewProps {
  tasks: QueueTask[];
  isRunning: boolean;
  activeTaskId: string | null;
  proxyConfig: ProxyConfig;
  onUpdateProxyConfig: (next: ProxyConfig) => void;
  onStartQueue: () => void;
  onPauseQueue: () => void;
  onRunSingleTask: (taskId: string) => void;
  onRetryFailed: () => void;
  onClearQueue: () => void;
  onBundleZip: () => Promise<void>;
  onExportCsv: () => void;
  onDownloadIndividual?: (task: QueueTask) => void;
  onOpenBatchRenameModal?: () => void;
  isBundlingZip: boolean;
  lastBundleStatus: string | null;
}

const TRANSPORT_LABELS: Record<TransportMode, string> = {
  SERVER_EXPRESS_RELAY: 'Server Express Relay (/api/eporcha-proxy)',
  CAPACITOR_NATIVE_HTTP: 'Capacitor Native HTTP (Android APK)',
  TERMUX_LOCAL_PROXY: 'Termux Local Relay (127.0.0.1:8787)',
  CLOUDFLARE_WORKER_PROXY: 'Custom Cloudflare Worker Relay',
  DIRECT_BROWSER_FETCH: 'Direct Browser Fetch (CORS-Restricted)',
};

export const QueueConsoleView: React.FC<QueueConsoleViewProps> = ({
  tasks,
  isRunning,
  activeTaskId,
  proxyConfig,
  onUpdateProxyConfig,
  onStartQueue,
  onPauseQueue,
  onRunSingleTask,
  onRetryFailed,
  onClearQueue,
  onBundleZip,
  onExportCsv,
  onDownloadIndividual,
  onOpenBatchRenameModal,
  isBundlingZip,
  lastBundleStatus,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const queuedCount = tasks.filter((t) => t.status === 'QUEUED').length;
  const verifiedCount = tasks.filter((t) => t.pdfVerified).length;
  const extractedIndexCount = tasks.filter(
    (t) => t.status === 'HTML_INDEX_EXTRACTED'
  ).length;
  const failedOrBlockedCount = tasks.filter(
    (t) =>
      t.status === 'CORS_BRIDGE_REQUIRED' ||
      t.status === 'NOT_AVAILABLE_ON_EPORCHA_TECH' ||
      t.status === 'FAILED_RETRY'
  ).length;

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'VERIFIED') return t.pdfVerified;
    if (statusFilter === 'QUEUED') return t.status === 'QUEUED';
    if (statusFilter === 'INDEX') return t.status === 'HTML_INDEX_EXTRACTED';
    if (statusFilter === 'ATTENTION')
      return (
        t.status === 'CORS_BRIDGE_REQUIRED' ||
        t.status === 'NOT_AVAILABLE_ON_EPORCHA_TECH' ||
        t.status === 'FAILED_RETRY'
      );
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Transport & Polite Queue Engine Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Live Sequential Queue & Binary Verification Console
            </h2>
            <p className="text-xs text-slate-400 font-bn mt-0.5">
              Polite anti-crash queue (450ms–900ms jitter) · Strict %PDF- (25 50 44 46 2D) &gt; 1,024B verification gate
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isRunning ? (
              <button
                type="button"
                onClick={onStartQueue}
                disabled={queuedCount === 0}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Start Queue ({queuedCount} Queued)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onPauseQueue}
                className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Queue</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRetryFailed}
              disabled={failedOrBlockedCount === 0 || isRunning}
              title="Iterates through all FAILED_RETRY, CORS_BRIDGE_REQUIRED, and NOT_AVAILABLE tasks and resets them to QUEUED with incremented retry count"
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Retry All Failed Tasks ({failedOrBlockedCount})</span>
            </button>

            <button
              type="button"
              onClick={onExportCsv}
              disabled={tasks.length === 0}
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {onOpenBatchRenameModal && (
              <button
                type="button"
                onClick={onOpenBatchRenameModal}
                disabled={tasks.length === 0}
                title="Apply a regex-based or token template naming pattern to downloaded PDFs in lr_verified_blobs"
                className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                <span>Batch Rename ({verifiedCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onBundleZip}
              disabled={tasks.length === 0 || isBundlingZip}
              className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Archive className="w-4 h-4" />
              <span>
                {isBundlingZip
                  ? 'Packaging ZIP...'
                  : `Download Audit ZIP (${verifiedCount} Verified PDFs)`}
              </span>
            </button>

            <button
              type="button"
              onClick={onClearQueue}
              disabled={tasks.length === 0 || isRunning}
              className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-300 disabled:opacity-40 text-slate-400 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Transport Selector Row */}
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="transport-mode-select"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Active HTTP Transport Bridge
            </label>
            <div className="relative flex items-center">
              <Server className="w-4 h-4 text-emerald-400 absolute left-3 pointer-events-none" />
              <select
                id="transport-mode-select"
                value={proxyConfig.preferredMode}
                onChange={(e) =>
                  onUpdateProxyConfig({
                    ...proxyConfig,
                    preferredMode: e.target.value as TransportMode,
                  })
                }
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {(Object.keys(TRANSPORT_LABELS) as TransportMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {TRANSPORT_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {proxyConfig.preferredMode === 'TERMUX_LOCAL_PROXY' && (
            <div>
              <label
                htmlFor="termux-url-input"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Termux Local Proxy Endpoint
              </label>
              <input
                id="termux-url-input"
                type="text"
                value={proxyConfig.termuxProxyUrl}
                onChange={(e) =>
                  onUpdateProxyConfig({
                    ...proxyConfig,
                    termuxProxyUrl: e.target.value,
                  })
                }
                placeholder="http://127.0.0.1:8787/proxy?url="
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {proxyConfig.preferredMode === 'CLOUDFLARE_WORKER_PROXY' && (
            <div>
              <label
                htmlFor="cf-url-input"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Cloudflare Worker Proxy URL
              </label>
              <input
                id="cf-url-input"
                type="text"
                value={proxyConfig.customCloudflareProxyUrl}
                onChange={(e) =>
                  onUpdateProxyConfig({
                    ...proxyConfig,
                    customCloudflareProxyUrl: e.target.value,
                  })
                }
                placeholder="https://your-worker.workers.dev/?url="
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="concurrency-select"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Polite Queue Concurrency & Jitter
            </label>
            <select
              id="concurrency-select"
              value={proxyConfig.concurrency}
              onChange={(e) =>
                onUpdateProxyConfig({
                  ...proxyConfig,
                  concurrency: Number(e.target.value) as 1 | 2 | 3,
                })
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Parallel Request · 450ms–900ms Jitter (Safest)</option>
              <option value={2}>2 Parallel Requests · 450ms–900ms Jitter (Balanced)</option>
              <option value={3}>3 Parallel Requests · 450ms–900ms Jitter (Maximum)</option>
            </select>
          </div>
        </div>

        {lastBundleStatus && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{lastBundleStatus}</span>
          </div>
        )}
      </div>

      {/* Filter Bar & Summary Counters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {[
            { id: 'ALL', label: `All Tasks (${tasks.length})` },
            { id: 'QUEUED', label: `Queued (${queuedCount})` },
            { id: 'VERIFIED', label: `Verified %PDF- (${verifiedCount})` },
            { id: 'INDEX', label: `HTML Index Extracted (${extractedIndexCount})` },
            { id: 'ATTENTION', label: `Portal HTML / Non-PDF (${failedOrBlockedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-mono-tabular">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </div>
      </div>

      {/* Queue Table */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <div className="text-sm font-semibold text-slate-200">
            No extraction tasks in this view
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Select a Document Mode, Upazila (e.g. Nabinagar — 100% Mouzas pre-selected), and Survey Types in the Extractor tab to enqueue authentic <code>eporcha.tech</code> tasks.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-4">Mouza & Survey</th>
                  <th className="py-3 px-4">Forensic Filename & Mode</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4 text-right">HTTP & Magic Hex</th>
                  <th className="py-3 px-4 text-right">Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filteredTasks.map((task) => {
                  const isCurrentlyFetching =
                    activeTaskId === task.id || task.status === 'FETCHING_EPORCHA_TECH';
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-white font-bn">
                          JL-{task.mouzaJlNo} · {task.mouzaNameBn} ({task.mouzaNameEn})
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {task.districtNameEn} · {task.upazilaNameEn} · {task.unionNameEn}
                        </div>
                        <div className="text-emerald-400 text-[11px] font-mono-tabular mt-0.5">
                          Survey: {task.surveyType}
                          {task.bookStyle
                            ? ` · Style: ${task.bookStyle.layout}/${task.bookStyle.colorMode}`
                            : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <div className="font-mono-tabular text-slate-200 break-all text-[11px]">
                          {task.fileName}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-1 font-mono-tabular truncate">
                          {task.targetUrl}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-100">
                          {isCurrentlyFetching ? (
                            <span className="text-amber-400 flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>FETCHING_EPORCHA_TECH</span>
                            </span>
                          ) : task.pdfVerified ? (
                            <span className="text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{task.status} (%PDF- VERIFIED)</span>
                            </span>
                          ) : (
                            <span className="text-amber-300 flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                              <span>{task.status}</span>
                            </span>
                          )}
                        </div>
                        {task.errorMessage && (
                          <p className="text-[11px] text-slate-400 mt-1 max-w-md leading-relaxed">
                            {task.errorMessage}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono-tabular">
                        <div className="text-slate-200">
                          {task.httpStatus ? `HTTP ${task.httpStatus}` : 'Pending'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {task.magicBytesHex || '—'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono-tabular text-slate-200">
                        {task.byteLength !== undefined
                          ? `${(task.byteLength / 1024).toFixed(1)} KB`
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {onDownloadIndividual && (task.pdfVerified || (task.byteLength && task.byteLength > 0)) && (
                            <button
                              type="button"
                              onClick={() => onDownloadIndividual(task)}
                              title={`Download individual ${task.fileName}`}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onRunSingleTask(task.id)}
                            disabled={isCurrentlyFetching}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {task.status === 'QUEUED' ? 'Fetch Now' : 'Re-Verify'}
                          </button>
                          <a
                            href={task.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${task.mouzaNameEn} ${task.surveyType} on eporcha.tech`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/80 text-emerald-400 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                          >
                            <span>eporcha.tech</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
