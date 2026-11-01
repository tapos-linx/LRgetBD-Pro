import React, { useState } from 'react';
import { BookOpen, Check, Copy, Download } from 'lucide-react';
import { ARCHITECTURE_DOCS } from '../data/architectureDocs';

export const ArchitectureDocsView: React.FC = () => {
  const [selectedDocId, setSelectedDocId] = useState<string>(
    ARCHITECTURE_DOCS[0].id
  );
  const [copied, setCopied] = useState(false);

  const activeDoc =
    ARCHITECTURE_DOCS.find((d) => d.id === selectedDocId) ||
    ARCHITECTURE_DOCS[0];

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(activeDoc.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([activeDoc.markdown], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeDoc.fileName.replace('/docs/', '');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Sidebar: 6-Document Selector */}
      <div className="lg:col-span-4 space-y-2.5">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Context-First 6-Document Architecture</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Synchronized with <code>/docs/01_PRD.md</code> through <code>/docs/06_Plan.md</code>.
          </p>
        </div>

        <div className="space-y-2">
          {ARCHITECTURE_DOCS.map((doc) => {
            const isSelected = doc.id === activeDoc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocId(doc.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500/80 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-emerald-400">
                  <span>{doc.fileName}</span>
                  <span className="text-slate-400">{doc.equivalentName}</span>
                </div>
                <div className="text-sm font-semibold text-white mt-1">
                  {doc.titleEn}
                </div>
                <div className="text-xs text-slate-400 font-bn mt-0.5">
                  {doc.titleBn}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Content Pane: Full Document Viewer */}
      <div className="lg:col-span-8">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono-tabular text-emerald-400">
                {activeDoc.fileName} · Equivalent: {activeDoc.equivalentName}
              </div>
              <h2 className="text-base font-semibold text-white mt-0.5">
                {activeDoc.titleEn}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              {activeDoc.summary}
            </p>
            <pre className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono-tabular text-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {activeDoc.markdown}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
