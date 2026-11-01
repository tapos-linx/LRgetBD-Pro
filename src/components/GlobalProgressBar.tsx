import React from 'react';
import { QueueProgressMetrics } from '../services/queueEngine';
import { Play, Pause, CheckCircle2, ArrowRight } from 'lucide-react';

interface GlobalProgressBarProps {
  metrics: QueueProgressMetrics;
  isQueueRunning: boolean;
  activeTab: string;
  onViewQueue: () => void;
  onToggleQueue?: () => void;
}

export const GlobalProgressBar: React.FC<GlobalProgressBarProps> = ({
  metrics,
  isQueueRunning,
  activeTab,
  onViewQueue,
  onToggleQueue,
}) => {
  const isComplete = metrics.totalCount > 0 && metrics.percentage === 100;
  const hasTasks = metrics.totalCount > 0;

  return (
    <div
      data-testid="global-progress-bar-container"
      role="region"
      aria-label="Global Task Completion Progress"
      className="border-t border-slate-800/80 bg-slate-900/95 backdrop-blur-md px-3 sm:px-8 py-2 transition-all duration-200"
    >
      {/* Top Telemetry Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
        {/* Left: Status Indicator & Percent */}
        <div className="flex items-center gap-2">
          {/* Running/State Badge */}
          <div className="flex items-center gap-1.5">
            {isQueueRunning ? (
              <span className="relative flex h-2 w-2" title="Queue is actively fetching records">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isComplete
                    ? 'bg-emerald-400'
                    : hasTasks
                    ? 'bg-amber-400'
                    : 'bg-slate-600'
                }`}
                aria-hidden="true"
              />
            )}
            <span className="font-semibold text-slate-200 text-xs">
              {isQueueRunning
                ? 'Queue Running'
                : isComplete
                ? 'All Tasks Complete'
                : hasTasks
                ? 'Queue In Progress'
                : 'Queue Idle'}
            </span>
          </div>

          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>

          {/* Completion Percentage Highlight */}
          <div className="flex items-baseline gap-1">
            <span className="font-mono font-bold text-sm text-emerald-400 tracking-tight">
              {metrics.percentage}%
            </span>
            <span className="text-slate-400 text-[11px] font-mono">
              ({metrics.completedCount}/{metrics.totalCount} completed)
            </span>
          </div>
        </div>

        {/* Right: Metrics & Quick Actions */}
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span className="hidden md:inline">
            <span className="text-emerald-400 font-semibold">{metrics.verifiedPdfCount}</span>{' '}
            verified PDFs
          </span>

          {metrics.failedCount > 0 && (
            <span className="text-amber-400 font-medium">
              {metrics.failedCount} retryable
            </span>
          )}

          {/* Queue toggle shortcut if provided */}
          {onToggleQueue && hasTasks && (
            <button
              type="button"
              onClick={onToggleQueue}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                isQueueRunning
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              {isQueueRunning ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Resume</span>
                </>
              )}
            </button>
          )}

          {/* Switch Tab shortcut if not in Queue tab */}
          {activeTab !== 'queue' && hasTasks && (
            <button
              type="button"
              onClick={onViewQueue}
              className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline text-[11px] flex items-center gap-0.5 ml-1"
            >
              <span>View Queue</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Track & Gradient Bar */}
      <div
        className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-800/90 relative"
        role="progressbar"
        aria-valuenow={metrics.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Queue task completion: ${metrics.percentage}%`}
      >
        <div
          data-testid="global-progress-bar-fill"
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            isQueueRunning
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)] animate-pulse'
              : isComplete
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500'
          }`}
          style={{ width: `${metrics.percentage}%` }}
        />
      </div>
    </div>
  );
};
