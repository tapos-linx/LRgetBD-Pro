import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Database,
  FileEdit,
  FolderArchive,
  RefreshCw,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { QueueTask } from '../types/land';
import {
  computeBatchRenamePreview,
  RenameMode,
  RenamePreset,
  RENAME_PRESETS,
} from '../services/batchRenameService';

interface BatchRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: QueueTask[];
  verifiedBlobTaskIds: Set<string>;
  onApplyRename: (renameMap: Map<string, string>) => Promise<void>;
}

export const BatchRenameModal: React.FC<BatchRenameModalProps> = ({
  isOpen,
  onClose,
  tasks,
  verifiedBlobTaskIds,
  onApplyRename,
}) => {
  const [mode, setMode] = useState<RenameMode>('TEMPLATE');
  const [templatePattern, setTemplatePattern] = useState(
    '{district}_{upazila}_JL-{jl}_{mouza}_{survey}_{mode}_{style}.pdf'
  );
  const [regexPattern, setRegexPattern] = useState('([A-Za-z]+)_([A-Za-z]+)');
  const [regexFlags, setRegexFlags] = useState('g');
  const [regexReplacement, setRegexReplacement] = useState('$1_$2');
  const [filterOnlyCached, setFilterOnlyCached] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  // Compute live preview
  const { previewItems, changedCount, regexError } = useMemo(() => {
    return computeBatchRenamePreview({
      tasks,
      verifiedBlobTaskIds,
      mode,
      templatePattern,
      regexPattern,
      regexFlags,
      regexReplacement,
    });
  }, [
    tasks,
    verifiedBlobTaskIds,
    mode,
    templatePattern,
    regexPattern,
    regexFlags,
    regexReplacement,
  ]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: RenamePreset) => {
    setMode(preset.mode);
    if (preset.mode === 'TEMPLATE' && preset.template) {
      setTemplatePattern(preset.template);
    } else if (preset.mode === 'REGEX') {
      if (preset.regexPattern !== undefined) setRegexPattern(preset.regexPattern);
      if (preset.regexFlags !== undefined) setRegexFlags(preset.regexFlags);
      if (preset.regexReplacement !== undefined)
        setRegexReplacement(preset.regexReplacement);
    }
  };

  const handleInsertToken = (token: string) => {
    setTemplatePattern((prev) => {
      if (prev.endsWith('.pdf')) {
        return prev.slice(0, -4) + token + '.pdf';
      }
      return prev + token;
    });
  };

  const handleConfirmRename = async () => {
    const renameMap = new Map<string, string>();
    for (const item of previewItems) {
      if (item.isChanged) {
        renameMap.set(item.taskId, item.newFileName);
      }
    }

    if (renameMap.size === 0) return;

    setIsApplying(true);
    setApplyFeedback(null);
    try {
      await onApplyRename(renameMap);
      setApplyFeedback(
        `Successfully renamed ${renameMap.size} records in IndexedDB ('lr_verified_blobs') and Queue.`
      );
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setApplyFeedback(
        `Rename failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsApplying(false);
    }
  };

  const displayedPreview = filterOnlyCached
    ? previewItems.filter((i) => i.hasCachedBlob)
    : previewItems;

  const availableTokens = [
    { label: '{district}', desc: 'District EN' },
    { label: '{upazila}', desc: 'Upazila EN' },
    { label: '{jl}', desc: 'JL No.' },
    { label: '{mouza}', desc: 'Mouza EN' },
    { label: '{survey}', desc: 'Survey (RS, BS)' },
    { label: '{mode}', desc: 'Doc Mode' },
    { label: '{style}', desc: 'Layout-Color' },
    { label: '{khatian}', desc: 'Khatian No.' },
    { label: '{mouzaBn}', desc: 'মৌজা (বাংলা)' },
    { label: '{upazilaBn}', desc: 'উপজেলা (বাংলা)' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-rename-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="batch-rename-title"
                className="text-base font-bold text-white flex items-center gap-2"
              >
                <span>Batch Rename Verified PDFs</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  lr_verified_blobs
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Apply token templates or regex find-and-replace to customize names of downloaded documents in IndexedDB and ZIP bundles.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Standard Presets</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {RENAME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Tag className="w-3 h-3 text-emerald-400" />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              onClick={() => setMode('TEMPLATE')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                mode === 'TEMPLATE'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Token Template Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('REGEX')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                mode === 'REGEX'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Regex Pattern & Replace</span>
            </button>
          </div>

          {/* Mode 1: Template Controls */}
          {mode === 'TEMPLATE' && (
            <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Template Pattern String
                </label>
                <input
                  type="text"
                  value={templatePattern}
                  onChange={(e) => setTemplatePattern(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                  placeholder="{district}_{upazila}_JL-{jl}_{mouza}_{survey}_{mode}.pdf"
                />
              </div>

              <div>
                <span className="block text-[11px] font-medium text-slate-400 mb-1.5">
                  Click to insert token variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableTokens.map((tok) => (
                    <button
                      key={tok.label}
                      type="button"
                      onClick={() => handleInsertToken(tok.label)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer"
                      title={tok.desc}
                    >
                      <span>{tok.label}</span>
                      <span className="text-[9px] text-slate-400">({tok.desc})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Regex Controls */}
          {mode === 'REGEX' && (
            <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Regular Expression Pattern
                  </label>
                  <input
                    type="text"
                    value={regexPattern}
                    onChange={(e) => setRegexPattern(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. ([A-Za-z]+)_new-color or \s+"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    RegExp Flags
                  </label>
                  <input
                    type="text"
                    value={regexFlags}
                    onChange={(e) => setRegexFlags(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                    placeholder="g, i, m"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Replacement String (Supports capture groups like $1, $2)
                </label>
                <input
                  type="text"
                  value={regexReplacement}
                  onChange={(e) => setRegexReplacement(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-teal-300 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. $1_VerifiedColor"
                />
              </div>

              {regexError && (
                <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-800/80 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{regexError}</span>
                </div>
              )}
            </div>
          )}

          {/* Feedback Banner if Any */}
          {applyFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{applyFeedback}</span>
            </div>
          )}

          {/* Live Preview Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Live Rename Preview</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                {changedCount} of {tasks.length} to change
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filterOnlyCached}
                onChange={(e) => setFilterOnlyCached(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-0"
              />
              <span>Show only cached in IndexedDB ({verifiedBlobTaskIds.size})</span>
            </label>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Storage</th>
                    <th className="py-2.5 px-3">Mouza & Survey</th>
                    <th className="py-2.5 px-3">Current Filename</th>
                    <th className="py-2.5 px-3">New Filename</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
                  {displayedPreview.slice(0, 50).map((item) => (
                    <tr
                      key={item.taskId}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        item.isChanged ? 'bg-emerald-950/10' : ''
                      }`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        {item.hasCachedBlob ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                            <Database className="w-2.5 h-2.5" />
                            <span>Cached</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                            <span>Queued</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {item.mouzaNameEn} ({item.surveyType})
                      </td>
                      <td className="py-2 px-3 text-slate-400 truncate max-w-[200px]" title={item.currentFileName}>
                        {item.currentFileName}
                      </td>
                      <td className="py-2 px-3 truncate max-w-[240px]" title={item.newFileName}>
                        {item.isChanged ? (
                          <span className="text-emerald-300 font-semibold flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{item.newFileName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">(Unchanged)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {displayedPreview.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-500">
                        No records match current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {displayedPreview.length > 50 && (
              <div className="py-1.5 px-3 bg-slate-900/80 border-t border-slate-800 text-[11px] text-slate-500 text-center">
                Showing first 50 of {displayedPreview.length} records. All {displayedPreview.length} will be renamed.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900/80">
          <div className="text-xs text-slate-400">
            {changedCount > 0 ? (
              <span className="text-emerald-400 font-medium">
                {changedCount} record(s) ready to rename in IndexedDB & queue.
              </span>
            ) : (
              <span>No filename differences detected.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRename}
              disabled={isApplying || changedCount === 0 || !!regexError}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Renaming...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Rename ({changedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
