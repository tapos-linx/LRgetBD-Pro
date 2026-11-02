import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpToLine,
  CheckCircle2,
  Gauge,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  EporchaEndpointType,
  ProxyConfig,
  QueueTask,
} from '../types/land';
import { ENDPOINT_MODE_META } from '../data/geoHierarchy';
import { computeQueueIntegrityHealthReport } from '../services/queueEngine';

interface IntegrityHealthViewProps {
  tasks: QueueTask[];
  proxyConfig: ProxyConfig;
  onUpdateProxyConfig: (next: ProxyConfig) => void;
  onRequeueFlagged: (filter?: {
    mouzaId?: string;
    endpointType?: EporchaEndpointType;
  }) => void;
  onPrioritizeMouza: (mouzaId: string) => void;
  onOpenQueueConsole: () => void;
}

type MouzaFilterTab = 'ALL' | 'FLAGGED' | 'HEALTHY' | 'PENDING';

export const IntegrityHealthView: React.FC<IntegrityHealthViewProps> = ({
  tasks,
  proxyConfig,
  onUpdateProxyConfig,
  onRequeueFlagged,
  onPrioritizeMouza,
  onOpenQueueConsole,
}) => {
  const [mouzaFilter, setMouzaFilter] = useState<MouzaFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const report = useMemo(
    () => computeQueueIntegrityHealthReport(tasks),
    [tasks]
  );

  const filteredMouzas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return report.byMouza.filter((m) => {
      if (mouzaFilter === 'FLAGGED' && m.flaggedCount === 0) return false;
      if (mouzaFilter === 'HEALTHY' && m.healthStatus !== 'HEALTHY')
        return false;
      if (mouzaFilter === 'PENDING' && m.healthStatus !== 'PENDING')
        return false;

      if (!q) return true;
      return (
        m.mouzaJlNo.toLowerCase().includes(q) ||
        m.mouzaNameEn.toLowerCase().includes(q) ||
        m.mouzaNameBn.includes(searchQuery) ||
        m.upazilaNameEn.toLowerCase().includes(q)
      );
    });
  }, [report.byMouza, mouzaFilter, searchQuery]);

  const throttledMouzaCount = report.byMouza.filter(
    (m) => m.throttlingSuspected || m.flaggedCount > 0
  ).length;

  const handleApplyAntiThrottleJitter = () => {
    const nextMin = Math.max(900, proxyConfig.minDelayMs);
    const nextMax = Math.max(1600, proxyConfig.maxDelayMs);
    onUpdateProxyConfig({
      ...proxyConfig,
      concurrency: 1,
      minDelayMs: nextMin,
      maxDelayMs: nextMax,
    });
    setActionFeedback(
      `Applied Anti-Throttling Profile: Concurrency locked to 1 request with ${nextMin}ms–${nextMax}ms polite jitter delay.`
    );
  };

  const riskBadgeConfig = {
    LOW: {
      label: 'LOW THROTTLING RISK',
      classes:
        'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
      icon: ShieldCheck,
    },
    MODERATE: {
      label: 'MODERATE SIZE VARIANCE',
      classes: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
      icon: AlertTriangle,
    },
    HIGH_THROTTLING_DETECTED: {
      label: 'SERVER-SIDE THROTTLING DETECTED',
      classes: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
      icon: ShieldAlert,
    },
  }[report.throttlingRiskLevel];

  const RiskIcon = riskBadgeConfig.icon;

  return (
    <div className="space-y-6">
      {/* 1. Executive Integrity Health & Throttling Telemetry Banner */}
      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="throttling-risk-badge"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold font-mono-tabular ${riskBadgeConfig.classes}`}
              >
                <RiskIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{riskBadgeConfig.label}</span>
              </span>
              <span className="text-xs text-slate-400 font-mono-tabular">
                Active Jitter Window: {proxyConfig.minDelayMs}ms–
                {proxyConfig.maxDelayMs}ms · Concurrency: {proxyConfig.concurrency}x
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                Queue Integrity Health &amp; Server-Side Throttling Diagnostics
              </span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              {report.throttlingSummary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleApplyAntiThrottleJitter}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Increase polite jitter delay to 900ms–1600ms and set concurrency to 1 to mitigate eporcha.tech rate-limiting"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Apply Anti-Throttle Jitter (900–1600ms)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onRequeueFlagged();
                setActionFeedback(
                  `Re-queued all ${report.flaggedCount} partial/truncated tasks for fresh retrieval.`
                );
              }}
              disabled={report.flaggedCount === 0}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-Queue Flagged ({report.flaggedCount})</span>
            </button>

            <button
              type="button"
              onClick={onOpenQueueConsole}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Open Live Queue Console →
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* 4-Card Summary Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Overall Integrity Health Score</span>
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono-tabular text-emerald-400">
              {report.overallHealthScorePercent}%
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular">
              {report.downloadedCount} of {report.totalTasks} tasks inspected
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Size-Verified Payloads (&ge;75% Avg)</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono-tabular text-white">
              {report.verifiedCount}
            </div>
            <div className="text-[11px] text-emerald-400 font-mono-tabular">
              Passed document-type size cross-reference
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Partial Suspects (45%–75% Avg)</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-black font-mono-tabular text-amber-400">
              {report.partialSuspectCount}
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular">
              Smaller-than-expected downloads
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Truncated / Corrupted (&lt;45% or &lt;1KB)</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-2xl font-black font-mono-tabular text-rose-400">
              {report.corruptedCount}
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular">
              {throttledMouzaCount} Mouza(s) showing size anomalies
            </div>
          </div>
        </div>
      </section>

      {/* 2. Document-Type Size Cross-Reference & Throttling Matrix */}
      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Document-Type Size Cross-Reference Matrix (Observed vs. Expected Baseline)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Flags specific document types that frequently return smaller-than-expected PDF/index streams due to upstream rate-limiting or throttling.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {report.byDocumentType.map((dt) => {
            const meta = ENDPOINT_MODE_META[dt.endpointType];
            const expectedKb = (dt.expectedBaselineBytes / 1024).toFixed(0);
            const observedKb =
              dt.downloadedCount > 0
                ? `${(dt.observedAverageBytes / 1024).toFixed(1)} KB`
                : 'No samples';

            return (
              <div
                key={dt.endpointType}
                data-testid={`doctype-integrity-card-${dt.endpointType}`}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                  dt.throttlingSuspected
                    ? 'bg-rose-950/20 border-rose-500/60'
                    : dt.flaggedCount > 0
                    ? 'bg-amber-950/20 border-amber-500/50'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono-tabular text-emerald-400">
                      {meta.path}
                    </span>
                    {dt.throttlingSuspected ? (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-bold">
                        Throttling Suspected
                      </span>
                    ) : dt.flaggedCount > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-bold">
                        {dt.flaggedCount} Flagged
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                        Healthy
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-bold text-white font-bn">
                    {meta.titleBn}
                  </div>
                  <div className="text-xs text-slate-300">{meta.titleEn}</div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono-tabular">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Expected Avg:</span>
                    <span className="text-slate-200">~{expectedKb} KB</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Observed Avg:</span>
                    <span
                      className={
                        dt.throttlingSuspected
                          ? 'text-rose-300 font-bold'
                          : 'text-emerald-300 font-semibold'
                      }
                    >
                      {observedKb}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Flagged / Total:</span>
                    <span className="text-slate-200">
                      {dt.flaggedCount} / {dt.downloadedCount} ({dt.flaggedRatePercent}%)
                    </span>
                  </div>
                </div>

                {dt.flaggedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onRequeueFlagged({ endpointType: dt.endpointType });
                      setActionFeedback(
                        `Re-queued ${dt.flaggedCount} flagged task(s) for /${dt.endpointType}.`
                      );
                    }}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-amber-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Re-Queue /{dt.endpointType} ({dt.flaggedCount})</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Mouza-Level Integrity & Smaller-Than-Expected File Size Breakdown */}
      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Mouza-Level Integrity Breakdown ({report.byMouza.length} Mouzas in Queue)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sorted by anomaly frequency to highlight specific Mouzas producing smaller-than-expected payloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Mouza by JL or name..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
              {(
                [
                  { id: 'ALL', label: `All Mouzas (${report.byMouza.length})` },
                  {
                    id: 'FLAGGED',
                    label: `Flagged / Throttled (${throttledMouzaCount})`,
                  },
                  {
                    id: 'HEALTHY',
                    label: `Healthy (${
                      report.byMouza.filter((m) => m.healthStatus === 'HEALTHY')
                        .length
                    })`,
                  },
                  {
                    id: 'PENDING',
                    label: `Pending (${
                      report.byMouza.filter((m) => m.healthStatus === 'PENDING')
                        .length
                    })`,
                  },
                ] as Array<{ id: MouzaFilterTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMouzaFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    mouzaFilter === tab.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-[11px] text-slate-400">
                <tr>
                  <th className="py-3 px-4">Mouza &amp; JL No</th>
                  <th className="py-3 px-4">Downloaded / Total</th>
                  <th className="py-3 px-4">Size-Verified</th>
                  <th className="py-3 px-4">Partial / Truncated</th>
                  <th className="py-3 px-4 text-right">Avg Size Deviation</th>
                  <th className="py-3 px-4">Throttling &amp; Integrity Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMouzas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-slate-400 text-xs"
                    >
                      No Mouzas match the selected integrity filter.
                    </td>
                  </tr>
                ) : (
                  filteredMouzas.map((m) => (
                    <tr
                      key={m.mouzaId}
                      className={`transition-colors ${
                        m.healthStatus === 'CRITICAL_TRUNCATION'
                          ? 'bg-rose-950/15 hover:bg-rose-950/25'
                          : m.healthStatus === 'THROTTLED_SUSPECT'
                          ? 'bg-amber-950/15 hover:bg-amber-950/25'
                          : 'hover:bg-slate-900/40'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white font-bn">
                          <span className="text-emerald-400 font-mono-tabular mr-1.5">
                            JL-{m.mouzaJlNo}
                          </span>
                          {m.mouzaNameBn} ({m.mouzaNameEn})
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {m.districtNameEn} · {m.upazilaNameEn}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono-tabular text-slate-200">
                        {m.downloadedCount} / {m.totalTasks} Tasks
                      </td>

                      <td className="py-3 px-4 font-mono-tabular text-emerald-400 font-semibold">
                        {m.verifiedCount} OK
                      </td>

                      <td className="py-3 px-4 font-mono-tabular">
                        {m.flaggedCount > 0 ? (
                          <span className="text-amber-300 font-semibold">
                            {m.partialSuspectCount} Partial · {m.corruptedCount} Truncated ({m.flaggedRatePercent}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">0 Flagged</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {m.downloadedCount > 0 ? (
                          <span
                            className={
                              m.averageDeviationPercent <= -25
                                ? 'text-rose-400 font-bold'
                                : m.averageDeviationPercent < 0
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                            }
                          >
                            {m.averageDeviationPercent >= 0
                              ? `+${m.averageDeviationPercent}%`
                              : `${m.averageDeviationPercent}%`}{' '}
                            vs avg
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {m.healthStatus === 'CRITICAL_TRUNCATION' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[11px] font-semibold">
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            <span>Throttled / Truncated</span>
                          </span>
                        )}
                        {m.healthStatus === 'THROTTLED_SUSPECT' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-semibold">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>Smaller-Than-Expected Size</span>
                          </span>
                        )}
                        {m.healthStatus === 'HEALTHY' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            <span>Integrity Verified</span>
                          </span>
                        )}
                        {m.healthStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-[11px]">
                            <span>Queued / Pending</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.flaggedCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                onRequeueFlagged({ mouzaId: m.mouzaId });
                                setActionFeedback(
                                  `Re-queued ${m.flaggedCount} flagged task(s) for Mouza JL-${m.mouzaJlNo} (${m.mouzaNameEn}).`
                                );
                              }}
                              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Re-Fetch ({m.flaggedCount})</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onPrioritizeMouza(m.mouzaId);
                              setActionFeedback(
                                `Prioritized JL-${m.mouzaJlNo} (${m.mouzaNameEn}) to top of queue.`
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowUpToLine className="w-3 h-3 text-emerald-400" />
                            <span>Prioritize</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
