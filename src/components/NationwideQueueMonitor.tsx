import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Clock,
  Layers,
  MapPin,
  ListOrdered,
  Sparkles,
} from 'lucide-react';
import { UpazilaNode, MouzaNode, QueueTask } from '../types/land';

interface NationwideQueueMonitorProps {
  upazila: UpazilaNode;
  districtNameEn: string;
  divisionNameEn: string;
  totalMouzasCount: number;
  selectedMouzas: MouzaNode[];
  tasks: QueueTask[];
  isQueueRunning: boolean;
  activeTaskId: string | null;
  onToggleQueue: () => void;
  onRestartQueue: () => void;
  onPrioritizeMouza?: (mouzaId: string) => void;
}

export const NationwideQueueMonitor: React.FC<NationwideQueueMonitorProps> = ({
  upazila,
  districtNameEn,
  divisionNameEn,
  totalMouzasCount,
  selectedMouzas,
  tasks,
  isQueueRunning,
  activeTaskId,
  onToggleQueue,
  onRestartQueue,
  onPrioritizeMouza,
}) => {
  // Find current running task and its index in the tasks list
  const activeTaskIndex = tasks.findIndex((t) => t.id === activeTaskId);
  const nextQueuedIndex = tasks.findIndex((t) => t.status === 'QUEUED');
  const displayIndex =
    activeTaskIndex >= 0
      ? activeTaskIndex
      : nextQueuedIndex >= 0
      ? nextQueuedIndex
      : 0;
  const activeTask =
    activeTaskIndex >= 0
      ? tasks[activeTaskIndex]
      : nextQueuedIndex >= 0
      ? tasks[nextQueuedIndex]
      : tasks[0] || null;

  // Group tasks or calculate stats
  const completedCount = tasks.filter(
    (t) => t.status === 'CACHED_INDEXEDDB' || t.status === 'HTML_INDEX_EXTRACTED'
  ).length;
  const queuedCount = tasks.filter((t) => t.status === 'QUEUED').length;
  const failedCount = tasks.filter(
    (t) => t.status === 'FAILED_RETRY' || t.status === 'CORS_BRIDGE_REQUIRED'
  ).length;
  const isFinished = tasks.length > 0 && queuedCount === 0 && !activeTaskId;

  const completionPercent =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 p-5 sm:p-6 shadow-xl space-y-5">
      {/* 1. Prominent "Total Mouzas Found" Hero Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Automated Nationwide Queue
            </span>
            <span className="text-xs text-slate-400">
              {divisionNameEn} → {districtNameEn} → {upazila.nameEn}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Total Mouzas Found:</span>
              <span className="text-emerald-400 font-mono-tabular underline decoration-emerald-500/50 decoration-2 underline-offset-4">
                {totalMouzasCount}
              </span>
            </h3>
            <span className="px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
              Auto-Selected ({selectedMouzas.length}/{totalMouzasCount})
            </span>
          </div>

          <p className="text-xs text-slate-300 font-bn">
            {upazila.nameBn} উপজেলার সব মৌজা স্বয়ংক্রিয়ভাবে নির্বাচিত হয়েছে এবং কিউ ইনডেক্স ০ (১ম মৌজা) থেকে ক্রমান্বয়ে প্রক্রিয়া সম্পন্ন হচ্ছে।
          </p>
        </div>

        {/* Quick Execution Status & Operational Controls: Pause, Resume, Reset to Index 0 */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleQueue}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              isQueueRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {isQueueRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : isFinished ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resume / Rerun</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{completedCount > 0 ? 'Resume' : 'Resume / Start Queue'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRestartQueue}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset and start from Queue Index 0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset to Index 0</span>
          </button>
        </div>
      </div>

      {/* 2. Active Queue Execution Tracker Bar */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-mono-tabular">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-bold">
              Index {displayIndex} of {tasks.length}
            </span>
            {isQueueRunning && activeTask ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                Active: JL-{activeTask.mouzaJlNo} · {activeTask.mouzaNameBn} ({activeTask.mouzaNameEn})
              </span>
            ) : isFinished ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Queue Completed: All {totalMouzasCount} Mouzas Processed Successfully
              </span>
            ) : activeTask ? (
              <span className="text-slate-300">
                Active Target: JL-{activeTask.mouzaJlNo} · {activeTask.mouzaNameBn} ({activeTask.mouzaNameEn})
              </span>
            ) : (
              <span className="text-slate-400">
                Ready to execute · Next: Index 0 (1st Mouza)
              </span>
            )}
          </div>

          <div className="text-slate-300 font-mono-tabular font-medium">
            Completion Counter:{' '}
            <span className="text-emerald-400 font-bold">{completedCount}</span> /{' '}
            {tasks.length} Tasks ({completionPercent}%)
          </div>
        </div>

        {/* Real-Time Visual Progress Bar */}
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono-tabular">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Completed: {completedCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
              Queued: {queuedCount}
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Failed: {failedCount}
              </span>
            )}
          </div>
          <div>
            Sequential Loop: Index 0 → {tasks.length > 0 ? tasks.length - 1 : 0} (Polite Jitter Delay Active)
          </div>
        </div>
      </div>

      {/* 3. Horizontal Scrollable Queue Array Preview (Index 0 to N-1) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
            <span>Processing Queue Array ({selectedMouzas.length} Mouzas × Document Tasks)</span>
          </span>
          <span className="text-[11px] font-mono-tabular text-slate-400">
            Click any Mouza below to prioritize it to the front of the queue
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {selectedMouzas.map((mouza, idx) => {
            const task = tasks.find((t) => t.mouzaId === mouza.id);
            const isCurrent = activeTask && activeTask.mouzaId === mouza.id;
            const isDone =
              task &&
              (task.status === 'CACHED_INDEXEDDB' ||
                task.status === 'HTML_INDEX_EXTRACTED');

            return (
              <button
                key={mouza.id}
                type="button"
                onClick={() => onPrioritizeMouza && onPrioritizeMouza(mouza.id)}
                title={`Click to prioritize JL-${mouza.jlNo} ${mouza.nameEn} in the download queue`}
                className={`shrink-0 px-3 py-2 rounded-xl border text-left text-xs font-mono-tabular transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-lg ring-1 ring-emerald-400/50'
                    : isDone
                    ? 'bg-slate-900/90 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] text-slate-400 font-bold">
                    #{idx}
                  </span>
                  <span className="text-emerald-400 font-bold text-[11px]">
                    JL-{mouza.jlNo}
                  </span>
                  {isCurrent && (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400 ml-auto" />
                  )}
                  {isDone && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />
                  )}
                </div>
                <div className="font-sans text-xs font-semibold text-white truncate max-w-[120px]">
                  {mouza.nameEn}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[120px] font-bn">
                  {mouza.nameBn}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
