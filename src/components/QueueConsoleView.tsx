import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  CheckCircle2,
  CheckSquare,
  Download,
  ExternalLink,
  FileEdit,
  FileSpreadsheet,
  GripVertical,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  ConcurrencyTunerTelemetry,
  ProxyConfig,
  QueueTask,
  SmartPauseActionMode,
  SmartPauseConfig,
  SmartPauseMonitorState,
  SmartSchedulerConfig,
  TransportMode,
  WorkWindowEvaluation,
} from '../types/land';
import {
  computeDocumentTypeSizeStats,
  evaluateTaskSizeIntegrity,
  formatSmartPauseDuration,
  getJitterBoundsForConcurrency,
} from '../services/queueEngine';
import { SmartBatchScheduler } from './SmartBatchScheduler';
import { LatencyTrendChart } from './LatencyTrendChart';

interface QueueConsoleViewProps {
  tasks: QueueTask[];
  isRunning?: boolean;
  isQueueRunning?: boolean;
  activeTaskId: string | null;
  proxyConfig: ProxyConfig;
  onUpdateProxyConfig: (next: ProxyConfig) => void;
  concurrencyTelemetry?: ConcurrencyTunerTelemetry;
  onStartQueue?: () => void;
  onPauseQueue?: () => void;
  onToggleQueue?: () => void;
  onRunSingleTask: (taskId: string) => void;
  onRetryFailed: () => void;
  onClearQueue: () => void;
  onBundleZip: () => Promise<void>;
  onExportCsv?: () => void;
  onExportAuditCsv?: () => void;
  onDownloadIndividual?: (task: QueueTask) => void;
  onDownloadTask?: (task: QueueTask) => void;
  onOpenBatchRenameModal?: () => void;
  onBatchRename?: () => void;
  onReorderTasks?: (sourceTaskId: string, targetTaskId: string) => void;
  onMoveTaskPriority?: (taskId: string, direction: 'UP' | 'DOWN' | 'TOP') => void;
  onPrioritizeMouza?: (mouzaId: string) => void;
  onBulkAction?: (taskIds: string[], action: 'FORCE_FETCH' | 'DELETE' | 'MOVE_TO_TOP') => void;
  onCancelTask?: (taskId: string) => void;
  onCancelAllPending?: () => void;
  verifiedBlobTaskIds?: Set<string>;
  isBundlingZip: boolean;
  lastBundleStatus: string | null;
  schedulerConfig?: SmartSchedulerConfig;
  schedulerEvaluation?: WorkWindowEvaluation;
  onUpdateSchedulerConfig?: (next: SmartSchedulerConfig) => void;
  manualOverrideActive?: boolean;
  onToggleManualOverride?: () => void;
  smartPauseConfig?: SmartPauseConfig;
  smartPauseState?: SmartPauseMonitorState;
  onUpdateSmartPauseConfig?: (next: SmartPauseConfig) => void;
  onDismissOrResumeSmartPause?: (resumeQueue: boolean) => void;
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
  isQueueRunning,
  activeTaskId,
  proxyConfig,
  onUpdateProxyConfig,
  concurrencyTelemetry,
  onStartQueue,
  onPauseQueue,
  onToggleQueue,
  onRunSingleTask,
  onRetryFailed,
  onClearQueue,
  onBundleZip,
  onExportCsv,
  onExportAuditCsv,
  onDownloadIndividual,
  onDownloadTask,
  onOpenBatchRenameModal,
  onBatchRename,
  onReorderTasks,
  onMoveTaskPriority,
  onPrioritizeMouza,
  onBulkAction,
  onCancelTask,
  onCancelAllPending,
  isBundlingZip,
  lastBundleStatus,
  schedulerConfig,
  schedulerEvaluation,
  onUpdateSchedulerConfig,
  manualOverrideActive = false,
  onToggleManualOverride,
  smartPauseConfig,
  smartPauseState,
  onUpdateSmartPauseConfig,
  onDismissOrResumeSmartPause,
}) => {
  const effectiveIsRunning = isRunning ?? isQueueRunning ?? false;
  const handleStart = onStartQueue ?? onToggleQueue ?? (() => {});
  const handlePause = onPauseQueue ?? onToggleQueue ?? (() => {});
  const handleExportCsv = onExportCsv ?? onExportAuditCsv ?? (() => {});
  const handleDownloadSingle = onDownloadIndividual ?? onDownloadTask;
  const handleBatchRenameModal = onOpenBatchRenameModal ?? onBatchRename;

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [priorityFeedback, setPriorityFeedback] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleAllVisibleTasks = (visibleTasks: QueueTask[]) => {
    setSelectedTaskIds((prev) => {
      const allSelected = visibleTasks.length > 0 && visibleTasks.every((t) => prev.has(t.id));
      if (allSelected) {
        const next = new Set(prev);
        visibleTasks.forEach((t) => next.delete(t.id));
        return next;
      } else {
        const next = new Set(prev);
        visibleTasks.forEach((t) => next.add(t.id));
        return next;
      }
    });
  };

  const handleBulkActionExecute = (action: 'FORCE_FETCH' | 'DELETE' | 'MOVE_TO_TOP') => {
    if (onBulkAction && selectedTaskIds.size > 0) {
      onBulkAction(Array.from(selectedTaskIds), action);
      setSelectedTaskIds(new Set());
    }
  };

  // Unique Mouzas in the current queue for 1-click Mouza prioritization
  const uniqueMouzasInQueue = useMemo(() => {
    const map = new Map<
      string,
      { mouzaId: string; jlNo: string; nameBn: string; nameEn: string; queuedCount: number }
    >();
    for (const t of tasks) {
      const existing = map.get(t.mouzaId);
      if (existing) {
        if (t.status === 'QUEUED') existing.queuedCount += 1;
      } else {
        map.set(t.mouzaId, {
          mouzaId: t.mouzaId,
          jlNo: t.mouzaJlNo,
          nameBn: t.mouzaNameBn,
          nameEn: t.mouzaNameEn,
          queuedCount: t.status === 'QUEUED' ? 1 : 0,
        });
      }
    }
    return Array.from(map.values());
  }, [tasks]);

  // Cross-reference downloaded file sizes against document-type average sizes
  const docTypeSizeStats = useMemo(
    () => computeDocumentTypeSizeStats(tasks),
    [tasks]
  );

  const taskIntegrityMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateTaskSizeIntegrity>>();
    for (const t of tasks) {
      map.set(t.id, evaluateTaskSizeIntegrity(t, docTypeSizeStats));
    }
    return map;
  }, [tasks, docTypeSizeStats]);

  const integrityFlaggedCount = useMemo(() => {
    let count = 0;
    for (const t of tasks) {
      const check = taskIntegrityMap.get(t.id);
      if (
        check &&
        (check.status === 'PARTIAL_SUSPECT' ||
          check.status === 'CORRUPTED_OR_TRUNCATED')
      ) {
        count++;
      }
    }
    return count;
  }, [tasks, taskIntegrityMap]);

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
  const permanentFailureCount = tasks.filter(
    (t) => t.status === 'PERMANENT_FAILURE'
  ).length;

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'VERIFIED') return t.pdfVerified;
    if (statusFilter === 'QUEUED') return t.status === 'QUEUED';
    if (statusFilter === 'INDEX') return t.status === 'HTML_INDEX_EXTRACTED';
    if (statusFilter === 'PERMANENT_FAILURE')
      return t.status === 'PERMANENT_FAILURE';
    if (statusFilter === 'INTEGRITY_FLAGGED') {
      const check = taskIntegrityMap.get(t.id);
      return (
        check?.status === 'PARTIAL_SUSPECT' ||
        check?.status === 'CORRUPTED_OR_TRUNCATED'
      );
    }
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
      {/* Smart Batch Scheduler (Off-Peak Work Window e.g. 2 AM - 6 AM) */}
      {schedulerConfig && schedulerEvaluation && onUpdateSchedulerConfig && (
        <SmartBatchScheduler
          config={schedulerConfig}
          evaluation={schedulerEvaluation}
          onChangeConfig={onUpdateSchedulerConfig}
          isQueueRunning={effectiveIsRunning}
          manualOverrideActive={manualOverrideActive}
          onToggleManualOverride={onToggleManualOverride ?? (() => {})}
          queuedCount={queuedCount}
        />
      )}

      {/* Transport & Polite Queue Engine Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Live Sequential Queue & Binary Verification Console
            </h2>
            <p className="text-xs text-slate-400 font-bn mt-0.5">
              Polite adaptive queue (7-Mouza batching) · Strict %PDF- structural parser + SHA-256 verification gate
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!effectiveIsRunning ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={queuedCount === 0}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Start Queue ({queuedCount} Queued)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Queue</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRetryFailed}
              disabled={failedOrBlockedCount === 0 || effectiveIsRunning}
              title="Iterates through all FAILED_RETRY, CORS_BRIDGE_REQUIRED, and NOT_AVAILABLE tasks and resets them to QUEUED with incremented retry count"
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Retry All Failed Tasks ({failedOrBlockedCount})</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={tasks.length === 0}
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {handleBatchRenameModal && (
              <button
                type="button"
                onClick={handleBatchRenameModal}
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

            {onCancelAllPending && (
              <button
                type="button"
                onClick={onCancelAllPending}
                disabled={queuedCount === 0 && !effectiveIsRunning}
                className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-amber-950/60 hover:text-amber-300 disabled:opacity-40 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Pending</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClearQueue}
              disabled={tasks.length === 0 || effectiveIsRunning}
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
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="concurrency-select"
                className="block text-xs font-medium text-slate-400"
              >
                Queue Concurrency &amp; Auto-Tuner
              </label>
              <button
                type="button"
                data-testid="toggle-auto-concurrency-btn"
                onClick={() =>
                  onUpdateProxyConfig({
                    ...proxyConfig,
                    autoTuneConcurrency: !(proxyConfig.autoTuneConcurrency ?? true),
                  })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  proxyConfig.autoTuneConcurrency ?? true
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-400'
                }`}
              >
                {proxyConfig.autoTuneConcurrency ?? true
                  ? 'Auto-Tuner: ON (AIMD)'
                  : 'Manual Lock'}
              </button>
            </div>
            <select
              id="concurrency-select"
              value={proxyConfig.concurrency}
              onChange={(e) => {
                const nextTier = Number(e.target.value) as 1 | 2 | 3 | 7;
                const jitter = getJitterBoundsForConcurrency(nextTier);
                onUpdateProxyConfig({
                  ...proxyConfig,
                  concurrency: nextTier,
                  minDelayMs: jitter.minDelayMs,
                  maxDelayMs: jitter.maxDelayMs,
                });
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Parallel Request · Sequential Backoff (450–850ms)</option>
              <option value={2}>2 Parallel Requests · Balanced (220–420ms)</option>
              <option value={3}>3 Parallel Requests · Fast Default (120–250ms)</option>
              <option value={7}>7 Parallel Requests · 7-Mouza Turbo Batch (80–180ms)</option>
            </select>
          </div>
        </div>

        {/* Automated Concurrency Tuner (AIMD) Live Telemetry Bar */}
        {concurrencyTelemetry && (
          <div
            data-testid="concurrency-tuner-telemetry"
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-tabular uppercase tracking-wider border ${
                  concurrencyTelemetry.currentConcurrency === 7
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : concurrencyTelemetry.currentConcurrency === 3
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    : concurrencyTelemetry.currentConcurrency === 2
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                }`}
              >
                {concurrencyTelemetry.regime.replace(/_/g, ' ')} ·{' '}
                {proxyConfig.concurrency}x Workers
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {concurrencyTelemetry.lastAdjustmentReason}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular text-slate-400 shrink-0">
              <div>
                <span>Rolling Avg: </span>
                <span
                  className={`font-bold ${
                    concurrencyTelemetry.rollingLatencyMs === 0
                      ? 'text-slate-300'
                      : concurrencyTelemetry.rollingLatencyMs <= 1000
                      ? 'text-emerald-400'
                      : concurrencyTelemetry.rollingLatencyMs >= 2800
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }`}
                >
                  {concurrencyTelemetry.rollingLatencyMs > 0
                    ? `${concurrencyTelemetry.rollingLatencyMs}ms`
                    : '—'}
                </span>
              </div>
              <span aria-hidden="true">·</span>
              <div>
                <span>Last: </span>
                <span className="text-slate-200 font-semibold">
                  {concurrencyTelemetry.lastLatencyMs > 0
                    ? `${concurrencyTelemetry.lastLatencyMs}ms`
                    : '—'}
                </span>
              </div>
              <span aria-hidden="true">·</span>
              <div>
                <span>Jitter: </span>
                <span className="text-slate-200">
                  {proxyConfig.minDelayMs}–{proxyConfig.maxDelayMs}ms
                </span>
              </div>
              <span aria-hidden="true">·</span>
              <div className="text-emerald-400">
                +{concurrencyTelemetry.totalScaleUps} Up
              </div>
              <div className="text-amber-400">
                -{concurrencyTelemetry.totalBackoffs} Down
              </div>
            </div>
          </div>
        )}

        {/* Smart Pause Portal Health Monitor & Triggered Notification Banner */}
        {smartPauseConfig && smartPauseState && (
          <div
            data-testid="smart-pause-panel"
            className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
              smartPauseState.isTriggered
                ? 'bg-rose-950/45 border-rose-500/60'
                : 'bg-slate-950 border-slate-800/90'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-tabular uppercase tracking-wider border flex items-center gap-1.5 ${
                    !smartPauseConfig.enabled
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : smartPauseState.isTriggered
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : smartPauseState.consecutiveTimeouts > 0 ||
                        smartPauseState.sustainedHighLatencyElapsedMs > 0
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>
                    {!smartPauseConfig.enabled
                      ? 'Smart Pause: OFF'
                      : smartPauseState.isTriggered
                      ? 'Smart Pause: TRIGGERED'
                      : 'Smart Pause Guard: ARMED'}
                  </span>
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Auto-suspends or notifies on {smartPauseConfig.consecutiveTimeoutsThreshold} consecutive timeouts or sustained &gt;{smartPauseConfig.sustainedLatencyThresholdMs}ms latency for &gt;{smartPauseConfig.sustainedDurationMinutes}m
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular shrink-0">
                <div>
                  <span className="text-slate-400">Timeouts: </span>
                  <span
                    data-testid="smart-pause-timeout-counter"
                    className={`font-bold ${
                      smartPauseState.consecutiveTimeouts >=
                      smartPauseConfig.consecutiveTimeoutsThreshold
                        ? 'text-rose-400'
                        : smartPauseState.consecutiveTimeouts > 0
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {smartPauseState.consecutiveTimeouts}/
                    {smartPauseConfig.consecutiveTimeoutsThreshold}
                  </span>
                </div>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <div>
                  <span className="text-slate-400">
                    &gt;{smartPauseConfig.sustainedLatencyThresholdMs}ms Spike:{' '}
                  </span>
                  <span
                    data-testid="smart-pause-spike-timer"
                    className={`font-bold ${
                      smartPauseState.sustainedHighLatencyElapsedMs >
                      smartPauseConfig.sustainedDurationMinutes * 60 * 1000
                        ? 'text-rose-400'
                        : smartPauseState.sustainedHighLatencyElapsedMs > 0
                        ? 'text-amber-300'
                        : 'text-slate-200'
                    }`}
                  >
                    {formatSmartPauseDuration(
                      smartPauseState.sustainedHighLatencyElapsedMs
                    )}{' '}
                    / {smartPauseConfig.sustainedDurationMinutes}m 00s
                  </span>
                </div>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <div>
                  <span className="text-slate-400">Perm. Failures: </span>
                  <span
                    data-testid="smart-pause-permanent-failure-count"
                    className={`font-bold ${
                      permanentFailureCount > 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {permanentFailureCount}
                  </span>
                </div>

                {onUpdateSmartPauseConfig && (
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="smart-pause-retry-budget-select"
                      className="text-slate-400"
                    >
                      Retry Budget:
                    </label>
                    <select
                      id="smart-pause-retry-budget-select"
                      aria-label="Automatic Retry Budget per Task"
                      data-testid="smart-pause-retry-budget-select"
                      value={smartPauseConfig.maxTaskRetryBudget || 3}
                      onChange={(e) =>
                        onUpdateSmartPauseConfig({
                          ...smartPauseConfig,
                          maxTaskRetryBudget: Math.max(
                            1,
                            Number(e.target.value) || 3
                          ),
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value={1}>1 Retry → Perm. Failure</option>
                      <option value={2}>2 Retries → Perm. Failure</option>
                      <option value={3}>3 Retries (Default)</option>
                      <option value={5}>5 Retries → Perm. Failure</option>
                      <option value={10}>10 Retries → Perm. Failure</option>
                    </select>
                  </div>
                )}

                {onUpdateSmartPauseConfig && (
                  <select
                    aria-label="Smart Pause Action Mode"
                    data-testid="smart-pause-mode-select"
                    value={
                      !smartPauseConfig.enabled
                        ? 'DISABLED'
                        : smartPauseConfig.actionMode
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'DISABLED') {
                        onUpdateSmartPauseConfig({
                          ...smartPauseConfig,
                          enabled: false,
                        });
                      } else {
                        onUpdateSmartPauseConfig({
                          ...smartPauseConfig,
                          enabled: true,
                          actionMode: val as SmartPauseActionMode,
                        });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="AUTO_SUSPEND_AND_NOTIFY">
                      Auto-Suspend Queue + Notify
                    </option>
                    <option value="NOTIFY_ONLY">
                      Notify Only (Keep Running)
                    </option>
                    <option value="DISABLED">Smart Pause Disabled</option>
                  </select>
                )}
              </div>
            </div>

            {smartPauseState.isTriggered && (
              <div
                data-testid="smart-pause-alert-banner"
                role="alert"
                className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-rose-200">
                      {smartPauseState.triggerReason === 'CONSECUTIVE_TIMEOUTS'
                        ? 'Portal Health Alert: 3+ Consecutive Timeouts Detected'
                        : 'Portal Health Alert: Sustained Latency Spike (>3,000ms for >5 Minutes)'}
                    </div>
                    <p className="text-[11px] text-rose-100/90 mt-0.5">
                      {smartPauseState.triggerMessage}
                    </p>
                  </div>
                </div>

                {onDismissOrResumeSmartPause && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid="smart-pause-resume-btn"
                      onClick={() => onDismissOrResumeSmartPause(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume Queue &amp; Reset</span>
                    </button>
                    <button
                      type="button"
                      data-testid="smart-pause-dismiss-btn"
                      onClick={() => onDismissOrResumeSmartPause(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-rose-500/40 text-rose-200 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Dismiss Alert
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* D3.js Line Chart: Average Fetch Latency (ms) over Last 50 Tasks */}
        <LatencyTrendChart
          tasks={tasks}
          concurrencyTelemetry={concurrencyTelemetry}
          maxTasks={50}
        />

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
            {
              id: 'INTEGRITY_FLAGGED',
              label: `Integrity Flagged (${integrityFlaggedCount})`,
            },
            { id: 'ATTENTION', label: `Portal HTML / Non-PDF (${failedOrBlockedCount})` },
            {
              id: 'PERMANENT_FAILURE',
              label: `Permanent Failures (${permanentFailureCount})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

      {/* Mouza Priority Bar & Drag-and-Drop Reorder Instructions */}
      {tasks.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-white">
                Prioritize Mouzas in Queue (Drag &amp; Drop Rows or Click Mouza Below — Preserves Queue &amp; Cache)
              </span>
            </div>
            {priorityFeedback && (
              <span className="text-xs text-emerald-400 font-mono-tabular">
                {priorityFeedback}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
            {uniqueMouzasInQueue.map((m, idx) => (
              <button
                key={m.mouzaId}
                type="button"
                onClick={() => {
                  if (onPrioritizeMouza) {
                    onPrioritizeMouza(m.mouzaId);
                    setPriorityFeedback(
                      `Prioritized JL-${m.jlNo} (${m.nameEn}) to front of pending download queue.`
                    );
                  }
                }}
                title={`Move all queued tasks for JL-${m.jlNo} ${m.nameEn} to top priority without clearing queue`}
                className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono-tabular flex items-center gap-1.5 transition-colors cursor-pointer ${
                  idx === 0
                    ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 hover:border-emerald-500/60 text-slate-300 hover:text-white'
                }`}
              >
                <ArrowUpToLine className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="font-bold text-emerald-400">JL-{m.jlNo}</span>
                <span className="font-bn">{m.nameBn}</span>
                <span className="text-slate-400">({m.nameEn})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Actions Toolbar */}
      {selectedTaskIds.size > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-slate-950 text-xs font-bold px-2 py-1 rounded">
              {selectedTaskIds.size} Selected
            </div>
            <span className="text-xs text-emerald-200 font-medium">
              Apply bulk actions to selected tasks:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkActionExecute('FORCE_FETCH')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Force Fetch</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkActionExecute('MOVE_TO_TOP')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowUpToLine className="w-3.5 h-3.5 text-emerald-400" />
              <span>Move to Top</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkActionExecute('DELETE')}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-red-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTaskIds(new Set())}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Queue Table */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <div className="text-sm font-semibold text-slate-200">
            No extraction tasks in this view
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Select a Document Mode, Upazila (e.g. Nabinagar — All 176 Mouzas Selected), and Survey Types in the Extractor tab to enqueue authentic <code>eporcha.tech</code> tasks.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-3 w-10">
                    <button
                      type="button"
                      onClick={() => toggleAllVisibleTasks(filteredTasks)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      {filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.has(t.id)) ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3 w-24">Priority / Drag</th>
                  <th className="py-3 px-4">Mouza &amp; Survey</th>
                  <th className="py-3 px-4">Forensic Filename &amp; Mode</th>
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span>Verification Status</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono-tabular font-bold text-emerald-400">
                        {verifiedCount + extractedIndexCount}/{tasks.length} Completed
                      </span>
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">HTTP &amp; Magic Hex</th>
                  <th className="py-3 px-4 text-right">Size &amp; Integrity Check</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filteredTasks.map((task) => {
                  const globalIdx = tasks.findIndex((t) => t.id === task.id);
                  const isCurrentlyFetching =
                    activeTaskId === task.id || task.status === 'FETCHING_EPORCHA_TECH';
                  const isDragged = draggedTaskId === task.id;
                  const isDragOver = dragOverTaskId === task.id && draggedTaskId !== task.id;
                  const integrity =
                    taskIntegrityMap.get(task.id) ||
                    evaluateTaskSizeIntegrity(task, docTypeSizeStats);

                  return (
                    <tr
                      key={task.id}
                      draggable={Boolean(onReorderTasks)}
                      onDragStart={(e) => {
                        setDraggedTaskId(task.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', task.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverTaskId !== task.id) {
                          setDragOverTaskId(task.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverTaskId === task.id) {
                          setDragOverTaskId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceId =
                          draggedTaskId || e.dataTransfer.getData('text/plain');
                        setDraggedTaskId(null);
                        setDragOverTaskId(null);
                        if (sourceId && sourceId !== task.id && onReorderTasks) {
                          onReorderTasks(sourceId, task.id);
                          setPriorityFeedback(
                            `Reordered queue priority without clearing tasks.`
                          );
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverTaskId(null);
                      }}
                      className={`transition-colors ${
                        isDragged
                          ? 'opacity-50 bg-slate-800/70'
                          : isDragOver
                          ? 'bg-emerald-950/60 border-t-2 border-t-emerald-400'
                          : selectedTaskIds.has(task.id)
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-3 align-top">
                        <button
                          type="button"
                          onClick={() => toggleTaskSelection(task.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          {selectedTaskIds.has(task.id) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-3 align-top font-mono-tabular">
                        <div className="flex items-center gap-1.5">
                          <span
                            title="Drag row to reorder queue processing priority"
                            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-emerald-400 p-1 rounded hover:bg-slate-800"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-bold text-emerald-400">
                            #{globalIdx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          {onMoveTaskPriority && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onMoveTaskPriority(task.id, 'TOP');
                                  setPriorityFeedback(
                                    `Moved JL-${task.mouzaJlNo} (${task.mouzaNameEn} · ${task.surveyType}) to top priority.`
                                  );
                                }}
                                disabled={globalIdx <= 0}
                                title="Prioritize to Top of Queue"
                                aria-label={`Prioritize ${task.mouzaNameEn} ${task.surveyType} to top of queue`}
                                className="p-1 rounded bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUpToLine className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMoveTaskPriority(task.id, 'UP')}
                                disabled={globalIdx <= 0}
                                title="Move Up One Position"
                                aria-label={`Move ${task.mouzaNameEn} ${task.surveyType} up`}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMoveTaskPriority(task.id, 'DOWN')}
                                disabled={globalIdx >= tasks.length - 1}
                                title="Move Down One Position"
                                aria-label={`Move ${task.mouzaNameEn} ${task.surveyType} down`}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

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
                          {task.batchIndex && task.batchTotal
                            ? ` · Batch ${task.batchIndex}/${task.batchTotal}`
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
                        {task.sha256 && (
                          <div className="text-emerald-400/90 text-[10px] mt-0.5 font-mono-tabular truncate">
                            SHA-256: {task.sha256.slice(0, 16)}…
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-100 flex flex-wrap items-center gap-1.5">
                          {isCurrentlyFetching ? (
                            <span className="text-amber-400 flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>FETCHING_EPORCHA_TECH</span>
                            </span>
                          ) : task.status === 'PERMANENT_FAILURE' ? (
                            <span
                              data-testid="permanent-failure-badge"
                              className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[11px] font-bold flex items-center gap-1.5"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>
                                PERMANENT FAILURE (Retry Budget {task.retryCount}/
                                {smartPauseConfig?.maxTaskRetryBudget ?? 3})
                              </span>
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
                          {task.retryCount > 0 &&
                            task.status !== 'PERMANENT_FAILURE' && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono-tabular text-amber-300">
                                Retry {task.retryCount}/
                                {smartPauseConfig?.maxTaskRetryBudget ?? 3}
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
                          {task.latencyMs !== undefined ? (
                            <span className="ml-1.5 text-[10px] text-emerald-400">
                              ({task.latencyMs}ms)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {task.magicBytesHex || '—'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono-tabular">
                        <div className="text-slate-200 font-semibold">
                          {task.byteLength !== undefined
                            ? `${(task.byteLength / 1024).toFixed(1)} KB`
                            : '—'}
                        </div>

                        {/* Visual Integrity Check Badge Cross-Referencing Document-Type Average */}
                        <div className="mt-1 flex flex-col items-end gap-0.5">
                          {integrity.status === 'INTEGRITY_VERIFIED' && (
                            <span
                              data-testid="integrity-check-badge"
                              data-integrity-status="INTEGRITY_VERIFIED"
                              title={integrity.reason}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{integrity.label}</span>
                            </span>
                          )}

                          {integrity.status === 'PARTIAL_SUSPECT' && (
                            <span
                              data-testid="integrity-check-badge"
                              data-integrity-status="PARTIAL_SUSPECT"
                              title={integrity.reason}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-semibold"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>{integrity.label}</span>
                            </span>
                          )}

                          {integrity.status === 'CORRUPTED_OR_TRUNCATED' && (
                            <span
                              data-testid="integrity-check-badge"
                              data-integrity-status="CORRUPTED_OR_TRUNCATED"
                              title={integrity.reason}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-semibold"
                            >
                              <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>{integrity.label}</span>
                            </span>
                          )}

                          {integrity.status === 'PENDING' && (
                            <span
                              data-testid="integrity-check-badge"
                              data-integrity-status="PENDING"
                              title={integrity.reason}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px]"
                            >
                              <span>
                                Avg ~{(integrity.averageBytes / 1024).toFixed(0)} KB
                              </span>
                            </span>
                          )}

                          {integrity.status !== 'PENDING' && (
                            <span className="text-[10px] text-slate-400">
                              {integrity.deviationPercent >= 0
                                ? `+${integrity.deviationPercent}%`
                                : `${integrity.deviationPercent}%`}{' '}
                              vs {(integrity.averageBytes / 1024).toFixed(1)} KB avg
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {onPrioritizeMouza && task.status === 'QUEUED' && (
                            <button
                              type="button"
                              onClick={() => {
                                onPrioritizeMouza(task.mouzaId);
                                setPriorityFeedback(
                                  `Prioritized all tasks for JL-${task.mouzaJlNo} (${task.mouzaNameEn}) to top of queue.`
                                );
                              }}
                              title={`Prioritize all tasks for Mouza JL-${task.mouzaJlNo} (${task.mouzaNameEn})`}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <ArrowUpToLine className="w-3 h-3" />
                              <span>Prioritize Mouza</span>
                            </button>
                          )}
                          {handleDownloadSingle && (task.pdfVerified || (task.byteLength && task.byteLength > 0)) && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSingle(task)}
                              title={`Download individual ${task.fileName}`}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          )}
                          {onCancelTask &&
                            (task.status === 'QUEUED' || task.status === 'FETCHING_EPORCHA_TECH') && (
                              <button
                                type="button"
                                onClick={() => onCancelTask(task.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 hover:text-rose-300 text-slate-300 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Cancel</span>
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
