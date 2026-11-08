import React from 'react';
import {
  Activity,
  AlarmClock,
  CalendarClock,
  CheckSquare,
  Clock,
  Globe,
  Moon,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Sun,
  Zap,
} from 'lucide-react';
import {
  SchedulerTimezoneMode,
  SmartSchedulerConfig,
  WorkWindowEvaluation,
} from '../types/land';

interface SmartBatchSchedulerProps {
  config: SmartSchedulerConfig;
  evaluation: WorkWindowEvaluation;
  onChangeConfig: (next: SmartSchedulerConfig) => void;
  isQueueRunning: boolean;
  manualOverrideActive: boolean;
  onToggleManualOverride: () => void;
  queuedCount: number;
  compact?: boolean;
}

const OFF_PEAK_PRESETS: Array<{
  id: string;
  label: string;
  sublabel: string;
  startTime: string;
  endTime: string;
}> = [
  {
    id: 'deep-night-2-6',
    label: '2:00 AM – 6:00 AM',
    sublabel: 'Recommended Deep Off-Peak',
    startTime: '02:00',
    endTime: '06:00',
  },
  {
    id: 'midnight-0-5',
    label: '12:00 AM – 5:00 AM',
    sublabel: 'Midnight Batch Window',
    startTime: '00:00',
    endTime: '05:00',
  },
  {
    id: 'overnight-23-6',
    label: '11:00 PM – 6:00 AM',
    sublabel: 'Extended Overnight (7h)',
    startTime: '23:00',
    endTime: '06:00',
  },
];

export const SmartBatchScheduler: React.FC<SmartBatchSchedulerProps> = ({
  config,
  evaluation,
  onChangeConfig,
  isQueueRunning,
  manualOverrideActive,
  onToggleManualOverride,
  queuedCount,
  compact = false,
}) => {
  const handleToggleEnabled = () => {
    onChangeConfig({
      ...config,
      enabled: !config.enabled,
    });
  };

  const handlePresetSelect = (startTime: string, endTime: string) => {
    onChangeConfig({
      ...config,
      enabled: true,
      startTime,
      endTime,
    });
  };

  const trafficBadge =
    evaluation.portalTrafficEstimate === 'OFF_PEAK_OPTIMAL' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
        <Moon className="w-3 h-3 text-emerald-400" />
        <span>Off-Peak Portal Load (Optimal)</span>
      </span>
    ) : evaluation.portalTrafficEstimate === 'PEAK_PORTAL_LOAD' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-semibold">
        <Sun className="w-3 h-3 text-amber-400" />
        <span>Peak Portal Traffic (Schedule Recommended)</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold">
        <Activity className="w-3 h-3 text-sky-400" />
        <span>Moderate Portal Traffic</span>
      </span>
    );

  if (compact) {
    return (
      <div
        data-testid="smart-batch-scheduler-compact"
        className={`p-3.5 rounded-xl border transition-all ${
          config.enabled
            ? evaluation.isWithinWindow
              ? 'bg-emerald-950/30 border-emerald-500/50'
              : 'bg-indigo-950/30 border-indigo-500/40'
            : 'bg-slate-950 border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock
              className={`w-4 h-4 shrink-0 ${
                config.enabled ? 'text-emerald-400' : 'text-slate-400'
              }`}
            />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Smart Batch Scheduler</span>
                {config.enabled && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono-tabular uppercase font-bold ${
                      evaluation.isWithinWindow
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {evaluation.isWithinWindow ? 'Window Active' : 'Scheduled Standby'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono-tabular mt-0.5">
                Work Window: <span className="text-slate-200 font-semibold">{evaluation.windowLabel12h}</span> · {evaluation.countdownText}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label="Scheduler Start Time"
              value={config.startTime}
              onChange={(e) =>
                onChangeConfig({ ...config, startTime: e.target.value || '02:00' })
              }
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500">to</span>
            <input
              type="time"
              aria-label="Scheduler End Time"
              value={config.endTime}
              onChange={(e) =>
                onChangeConfig({ ...config, endTime: e.target.value || '06:00' })
              }
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleToggleEnabled}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                config.enabled
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {config.enabled ? 'Auto-Schedule ON' : 'Enable 2–6 AM Window'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="smart-batch-scheduler"
      className={`p-5 rounded-2xl border transition-all space-y-4 ${
        config.enabled
          ? evaluation.isWithinWindow
            ? 'bg-emerald-950/25 border-emerald-500/50 shadow-sm shadow-emerald-950/30'
            : 'bg-slate-900 border-indigo-500/40'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <AlarmClock
              className={`w-4 h-4 shrink-0 ${
                config.enabled ? 'text-emerald-400' : 'text-slate-400'
              }`}
            />
            <h3 className="text-sm font-bold text-white">
              Smart Batch Scheduler (Off-Peak Work Window)
            </h3>
            {trafficBadge}
            {config.enabled && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  evaluation.isWithinWindow
                    ? 'bg-emerald-500 text-slate-950'
                    : manualOverrideActive
                    ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
                    : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                }`}
              >
                {evaluation.isWithinWindow
                  ? 'In Work Window · Running'
                  : manualOverrideActive
                  ? 'Manual Override Active'
                  : 'Scheduled Standby'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Automatically starts and pauses the sequential download queue during your off-peak work window (e.g., <span className="text-slate-200 font-semibold">2:00 AM – 6:00 AM</span>) to avoid daytime <code className="text-emerald-400">eporcha.tech</code> throttling and maximize binary integrity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono-tabular flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400">Clock:</span>
            <span className="text-white font-semibold">{evaluation.currentTime12h}</span>
          </div>

          {config.enabled && !evaluation.isWithinWindow && (
            <button
              type="button"
              onClick={onToggleManualOverride}
              disabled={queuedCount === 0 && !isQueueRunning}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                manualOverrideActive
                  ? 'bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {manualOverrideActive
                  ? 'Return to Scheduled Standby'
                  : 'Bypass Window & Run Now'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleEnabled}
            data-testid="toggle-smart-scheduler-btn"
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              config.enabled
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>
              {config.enabled ? 'Scheduler Active (ON)' : 'Enable Smart Scheduler'}
            </span>
          </button>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        {/* Start & End Time Pickers */}
        <div className="md:col-span-4 grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="scheduler-start-time"
              className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5"
            >
              Window Start Time
            </label>
            <input
              id="scheduler-start-time"
              type="time"
              value={config.startTime}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  startTime: e.target.value || '02:00',
                })
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label
              htmlFor="scheduler-end-time"
              className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5"
            >
              Window End Time
            </label>
            <input
              id="scheduler-end-time"
              type="time"
              value={config.endTime}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  endTime: e.target.value || '06:00',
                })
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Timezone Reference */}
        <div className="md:col-span-4">
          <label
            htmlFor="scheduler-tz-mode"
            className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5"
          >
            Reference Clock Zone
          </label>
          <div className="relative flex items-center">
            <Globe className="w-3.5 h-3.5 text-emerald-400 absolute left-3 pointer-events-none" />
            <select
              id="scheduler-tz-mode"
              value={config.timezoneMode}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  timezoneMode: e.target.value as SchedulerTimezoneMode,
                })
              }
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="BD_STANDARD">
                Bangladesh Portal Time (UTC+6 · Asia/Dhaka)
              </option>
              <option value="LOCAL_SYSTEM">
                Device Local System Time
              </option>
            </select>
          </div>
        </div>

        {/* Live Window Status Box */}
        <div className="md:col-span-4 p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Configured Window
            </div>
            <div className="text-xs font-bold font-mono-tabular text-emerald-400">
              {evaluation.windowLabel12h}
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-300">
              {evaluation.countdownText}
            </div>
          </div>
          <div className="shrink-0">
            {evaluation.isWithinWindow ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                <Play className="w-3 h-3 fill-current" />
                <span>In Window</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-semibold">
                <Moon className="w-3 h-3 text-amber-400" />
                <span>Waiting</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Presets & Behavior Policies */}
      <div className="pt-3 border-t border-slate-800/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Quick Off-Peak Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">
            Quick Work Windows:
          </span>
          {OFF_PEAK_PRESETS.map((preset) => {
            const isSelected =
              config.startTime === preset.startTime &&
              config.endTime === preset.endTime;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  handlePresetSelect(preset.startTime, preset.endTime)
                }
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono-tabular transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <Moon className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{preset.label}</span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  ({preset.sublabel})
                </span>
              </button>
            );
          })}
        </div>

        {/* Automation Checkboxes */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() =>
              onChangeConfig({
                ...config,
                autoPauseOutsideWindow: !config.autoPauseOutsideWindow,
              })
            }
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            {config.autoPauseOutsideWindow ? (
              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Square className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <span>Auto-pause outside window</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeConfig({
                ...config,
                autoRetryFailedOnWindowStart:
                  !config.autoRetryFailedOnWindowStart,
              })
            }
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            {config.autoRetryFailedOnWindowStart ? (
              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Square className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <RotateCcw className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Auto-retry failed tasks at window start</span>
          </button>
        </div>
      </div>
    </div>
  );
};
