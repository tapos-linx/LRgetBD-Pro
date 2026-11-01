import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { KhatianRecord } from '../types/land';
import { extractStructuredRecordsFromText } from '../services/binaryValidator';

interface TabularIndexViewProps {
  records: KhatianRecord[];
  onImportRecords: (newRecords: KhatianRecord[]) => Promise<void>;
  onClearRecords: () => Promise<void>;
}

export const TabularIndexView: React.FC<TabularIndexViewProps> = ({
  records,
  onImportRecords,
  onClearRecords,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [surveyFilter, setSurveyFilter] = useState<string>('ALL');
  const [rawPasteOpen, setRawPasteOpen] = useState(false);
  const [rawPayloadText, setRawPayloadText] = useState('');
  const [pasteMouzaJl, setPasteMouzaJl] = useState('114');
  const [pasteMouzaBn, setPasteMouzaBn] = useState('গোয়ালী');
  const [pasteMouzaEn, setPasteMouzaEn] = useState('Goalai');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const filtered = records.filter((r) => {
    if (surveyFilter !== 'ALL' && r.surveyType !== surveyFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.khatianNo.toLowerCase().includes(q) ||
      r.ownerName.toLowerCase().includes(q) ||
      r.dagNo.toLowerCase().includes(q) ||
      r.mouzaNameEn.toLowerCase().includes(q) ||
      r.mouzaNameBn.includes(searchQuery) ||
      r.mouzaJlNo.includes(q)
    );
  });

  const handleParsePayload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPayloadText.trim()) {
      setImportFeedback('Paste a valid HTML <table> or JSON array from eporcha.tech first.');
      return;
    }

    const extracted = extractStructuredRecordsFromText(rawPayloadText, {
      districtName: 'Brahmanbaria',
      upazilaName: 'Nabinagar',
      unionName: '20-No Kaitala South Union',
      mouzaNameEn: pasteMouzaEn || 'Goalai',
      mouzaNameBn: pasteMouzaBn || 'গোয়ালী',
      mouzaJlNo: pasteMouzaJl || '114',
      surveyType: 'RS',
      sourceUrl: `https://eporcha.tech/survey-khatian?mouza_jl=${pasteMouzaJl}`,
    });

    if (extracted.length === 0) {
      setImportFeedback(
        'No valid Khatian/Dag rows detected. Provide JSON with khatian_no/owner_name/dag_no or an HTML <table>.'
      );
      return;
    }

    await onImportRecords(extracted);
    setImportFeedback(
      `Indexed ${extracted.length} Khatian/Dag records into IndexedDB (lr_eporcha_records_v2).`
    );
    setRawPayloadText('');
  };

  const handleExportCsv = () => {
    const headers = [
      'Record_ID',
      'District',
      'Upazila',
      'Union',
      'Mouza_JL',
      'Mouza_BN',
      'Mouza_EN',
      'Survey',
      'Khatian_No',
      'Owner_Name',
      'Dag_No',
      'Total_Land_Acres',
      'Source_URL',
    ];
    const rows = filtered.map((r) =>
      [
        r.recordId,
        r.districtName,
        r.upazilaName,
        r.unionName,
        r.mouzaJlNo,
        r.mouzaNameBn,
        r.mouzaNameEn,
        r.surveyType,
        r.khatianNo,
        `"${r.ownerName.replace(/"/g, '""')}"`,
        `"${r.dagNo.replace(/"/g, '""')}"`,
        r.totalLandAcres,
        r.sourceUrl,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LRgetBD_Khatian_Dag_Index_${filtered.length}rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Offline Khatian & Dag Tabular Index (খতিয়ান ও দাগ সূচি)
            </h2>
            <p className="text-xs text-slate-400 font-bn mt-0.5">
              IndexedDB Store: <code>lr_eporcha_records_v2</code> · Searchable by খতিয়ান নম্বর, মালিক/দলিলধারী, দাগ নম্বর, or JL No.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setRawPasteOpen(!rawPasteOpen)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {rawPasteOpen
                  ? 'Hide HTML/JSON Table Parser'
                  : 'Parse eporcha.tech HTML/JSON Table'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Index CSV ({filtered.length})</span>
            </button>

            <button
              type="button"
              onClick={onClearRecords}
              disabled={records.length === 0}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-300 disabled:opacity-40 text-slate-400 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Index</span>
            </button>
          </div>
        </div>

        {/* Optional HTML/JSON Parser Drawer */}
        {rawPasteOpen && (
          <form
            onSubmit={handleParsePayload}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
          >
            <div className="text-xs font-semibold text-slate-200">
              Import & Validate eporcha.tech Structured Table Payload (JSON or HTML &lt;table&gt;)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="paste-jl"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Mouza JL No
                </label>
                <input
                  id="paste-jl"
                  type="text"
                  value={pasteMouzaJl}
                  onChange={(e) => setPasteMouzaJl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono-tabular text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="paste-bn"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Mouza Name (Bengali)
                </label>
                <input
                  id="paste-bn"
                  type="text"
                  value={pasteMouzaBn}
                  onChange={(e) => setPasteMouzaBn(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bn text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="paste-en"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Mouza Name (English)
                </label>
                <input
                  id="paste-en"
                  type="text"
                  value={pasteMouzaEn}
                  onChange={(e) => setPasteMouzaEn(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="raw-payload-textarea"
                className="block text-[11px] text-slate-400 mb-1"
              >
                Raw HTML &lt;table&gt; or JSON Array from eporcha.tech
              </label>
              <textarea
                id="raw-payload-textarea"
                rows={4}
                value={rawPayloadText}
                onChange={(e) => setRawPayloadText(e.target.value)}
                placeholder='[{"khatian_no":"101","owner_name":"আব্দুল করিম","dag_no":"1420, 1421","total_land":"1.45"}]'
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono-tabular text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-emerald-400">
                {importFeedback || ''}
              </span>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Validate & Index Rows
              </button>
            </div>
          </form>
        )}

        {/* Search & Survey Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
          <div className="md:col-span-2 relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              aria-label="Search Khatian number, Owner name, or Dag number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by খতিয়ান নম্বর, মালিক/দলিলধারী, দাগ নম্বর, or Mouza..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <select
              aria-label="Filter index by survey type"
              value={surveyFilter}
              onChange={(e) => setSurveyFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Surveys ({records.length})</option>
              <option value="CS">CS (সিএস)</option>
              <option value="SA">SA (এসএ)</option>
              <option value="RS">RS (আরএস)</option>
              <option value="BS">BS (বিএস)</option>
              <option value="MUTATION">Mutation (নামজারি)</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-200">
            No tabular Khatian or Dag records indexed yet
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            When the Queue Engine receives structured Khatian/Dag tables from <code>eporcha.tech/survey-khatian</code> or <code>/namjari-khatian</code>, or when you parse an HTML/JSON table above, rows appear here for offline search.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-4">Mouza & JL</th>
                  <th className="py-3 px-4">Survey</th>
                  <th className="py-3 px-4">খতিয়ান নম্বর (Khatian)</th>
                  <th className="py-3 px-4">মালিক / দলিলধারী (Owner)</th>
                  <th className="py-3 px-4">দাগ নম্বর (Dag List)</th>
                  <th className="py-3 px-4 text-right">মোট জমি (Acres)</th>
                  <th className="py-3 px-4 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filtered.map((rec) => (
                  <tr
                    key={rec.recordId}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-bn text-white">
                      JL-{rec.mouzaJlNo} · {rec.mouzaNameBn} ({rec.mouzaNameEn})
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-emerald-400">
                      {rec.surveyType}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular font-semibold text-white">
                      {rec.khatianNo}
                    </td>
                    <td className="py-3 px-4 font-bn text-slate-200">
                      {rec.ownerName}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-300">
                      {rec.dagNo}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-amber-300">
                      {rec.totalLandAcres}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={rec.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-mono-tabular text-[11px]"
                      >
                        <span>eporcha.tech</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
