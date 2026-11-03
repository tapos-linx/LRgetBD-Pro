import React, { useState } from 'react';
import {
  CheckSquare,
  FileSpreadsheet,
  Filter,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Square,
  Upload,
} from 'lucide-react';
import { UseCascadingGeoReturn } from '../hooks/useCascadingGeo';
import { GEO_HIERARCHY } from '../data/geoHierarchy';

interface GeoMouzaSelectorProps {
  geo: UseCascadingGeoReturn;
}

export const GeoMouzaSelector: React.FC<GeoMouzaSelectorProps> = ({ geo }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Custom single mouza inputs
  const [customJl, setCustomJl] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customNameBn, setCustomNameBn] = useState('');
  const [customUnionEn, setCustomUnionEn] = useState('20-No Kaitala South Union');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  const handleAddMouzaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customJl.trim() || !customNameEn.trim()) {
      setCustomFormError('JL Number and English Name are required.');
      return;
    }
    setCustomFormError(null);
    geo.addCustomMouza({
      jlNo: customJl.trim(),
      nameEn: customNameEn.trim(),
      nameBn: customNameBn.trim() || customNameEn.trim(),
      unionNameEn: customUnionEn.trim() || 'Custom Union',
      unionNameBn: customUnionEn.trim() || 'কাস্টম ইউনিয়ন',
      availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'],
      estimatedKhatians: 500,
      estimatedDags: 1200,
      mapSheets: [1],
    });
    setCustomJl('');
    setCustomNameEn('');
    setCustomNameBn('');
    setShowAddForm(false);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    const count = geo.importCustomMouzasJsonOrCsv(importText);
    setImportMessage(`Successfully imported and selected ${count} custom Mouzas.`);
    setImportText('');
    setTimeout(() => {
      setImportMessage(null);
      setShowImportBox(false);
    }, 2000);
  };

  return (
    <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
      {/* Header and Fast Batch Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>01. Cascading Area & All Mouza Selection (বিভাগ → জেলা → উপজেলা → সকল মৌজা নির্বাচন)</span>
          </h2>
          <p className="text-xs text-slate-400 font-bn mt-0.5">
            উপজেলা নির্বাচন করার সাথে সাথে উক্ত উপজেলার সকল মৌজা গণনা, লোড ও সিলেক্ট হয়ে ডাউনলোড কিউ প্রস্তুত করে।
          </p>
        </div>

        {/* Counter and Fast Batch Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono-tabular text-slate-200">
            {geo.activeUpazila.nameEn}:{' '}
            <span className="text-emerald-400 font-bold">
              {geo.selectedCount}
            </span>
            /{geo.totalMouzasCount} Selected
          </div>

          <button
            type="button"
            onClick={geo.selectAll100Percent}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/60 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Select All Mouzas
          </button>

          <button
            type="button"
            onClick={geo.deselectAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Deselect All
          </button>

          <button
            type="button"
            onClick={geo.invertSelection}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Invert</span>
          </button>

          {geo.activeUpazila.id === 'upz-nabinagar' && (
            <button
              type="button"
              onClick={() => geo.selectUnionOnly('20-No Kaitala South Union')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/60 hover:bg-amber-500/30 text-amber-200 text-xs font-medium font-bn transition-colors whitespace-nowrap shrink-0"
            >
              ২০নং কাইতলা দক্ষিণ (Goalai · Kaitala)
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowImportBox(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add Mouza JL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowImportBox(!showImportBox);
              setShowAddForm(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import CSV/JSON</span>
          </button>
        </div>
      </div>

      {/* Cascading Dropdown Menus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="division-select-box"
            className="block text-xs text-slate-400 mb-1 font-bn"
          >
            ১. বিভাগ (Division — {GEO_HIERARCHY.length} Available)
          </label>
          <select
            id="division-select-box"
            value={geo.selectedDivisionId}
            onChange={(e) => geo.setSelectedDivisionId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-bn focus:outline-none focus:border-emerald-500"
          >
            {GEO_HIERARCHY.map((div) => (
              <option key={div.id} value={div.id}>
                {div.nameBn} ({div.nameEn}) — {div.districts.length} Districts
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="district-select-box"
            className="block text-xs text-slate-400 mb-1 font-bn"
          >
            ২. জেলা নির্বাচন করুন (District — {geo.activeDivision.districts.length} Available)
          </label>
          <select
            id="district-select-box"
            value={geo.selectedDistrictId}
            onChange={(e) => geo.setSelectedDistrictId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-bn focus:outline-none focus:border-emerald-500"
          >
            {geo.activeDivision.districts.map((dist) => (
              <option key={dist.id} value={dist.id}>
                {dist.nameBn} ({dist.nameEn}) — {dist.upazilas.length} Upazilas
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="upazila-select-box"
            className="block text-xs text-emerald-400 font-semibold mb-1 font-bn"
          >
            ৩. উপজেলা (Upazila in {geo.activeDistrict.nameEn} — {geo.activeDistrict.upazilas.length} Upazilas)
          </label>
          <select
            id="upazila-select-box"
            value={geo.selectedUpazilaId}
            onChange={(e) => geo.setSelectedUpazilaId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-emerald-500/70 text-xs text-white font-bn focus:outline-none focus:border-emerald-400"
          >
            {geo.activeDistrict.upazilas.map((upz) => {
              const customs = (geo.customMouzasByUpazila[upz.id] || []).length;
              return (
                <option key={upz.id} value={upz.id}>
                  {upz.nameBn} ({upz.nameEn}) — Total {upz.mouzas.length + customs} Mouzas
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label
            htmlFor="union-select-box"
            className="block text-xs text-slate-400 mb-1 font-bn"
          >
            ৪. ইউনিয়ন ফিল্টার (Union Filter)
          </label>
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              id="union-select-box"
              value={geo.selectedUnion}
              onChange={(e) => geo.setSelectedUnion(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">
                All Unions ({geo.allMouzasForUpazila.length} Mouzas)
              </option>
              {geo.availableUnions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add Single Custom Mouza Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddMouzaSubmit}
          className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
        >
          <div className="text-xs font-semibold text-white">
            Register Custom eporcha.tech Mouza under {geo.activeUpazila.nameEn}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="input-mouza-jl" className="block text-[11px] text-slate-400 mb-1">
                JL Number *
              </label>
              <input
                id="input-mouza-jl"
                type="text"
                value={customJl}
                onChange={(e) => setCustomJl(e.target.value)}
                placeholder="e.g. 125"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono-tabular text-white"
              />
            </div>
            <div>
              <label htmlFor="input-mouza-name-en" className="block text-[11px] text-slate-400 mb-1">
                Mouza English Name *
              </label>
              <input
                id="input-mouza-name-en"
                type="text"
                value={customNameEn}
                onChange={(e) => setCustomNameEn(e.target.value)}
                placeholder="e.g. Goalai North"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="input-mouza-name-bn" className="block text-[11px] text-slate-400 mb-1">
                Mouza Bengali Name
              </label>
              <input
                id="input-mouza-name-bn"
                type="text"
                value={customNameBn}
                onChange={(e) => setCustomNameBn(e.target.value)}
                placeholder="e.g. উত্তর গোয়ালী"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bn text-white"
              />
            </div>
            <div>
              <label htmlFor="input-mouza-union" className="block text-[11px] text-slate-400 mb-1">
                Union Name
              </label>
              <input
                id="input-mouza-union"
                type="text"
                value={customUnionEn}
                onChange={(e) => setCustomUnionEn(e.target.value)}
                placeholder="20-No Kaitala South Union"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
            </div>
          </div>
          {customFormError && (
            <div className="text-xs text-amber-400">{customFormError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
            >
              Add & Select Mouza
            </button>
          </div>
        </form>
      )}

      {/* Import CSV / JSON Box */}
      {showImportBox && (
        <form
          onSubmit={handleImportSubmit}
          className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Import Mouza Dataset (CSV or JSON)</span>
            </span>
            <span className="text-[11px] font-normal text-slate-400">
              Format: <code>JL, NameEn, NameBn, Union</code>
            </span>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="114, Goalai, গোয়ালী, 20-No Kaitala South&#10;115, Kaitala, কাইতলা, 20-No Kaitala South"
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
          />
          {importMessage && (
            <div className="text-xs text-emerald-400">{importMessage}</div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImportBox(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
            >
              Import Mouzas
            </button>
          </div>
        </form>
      )}

      {/* Live Search Bar and One-Tap Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            aria-label="Filter Mouzas by JL number, Bengali name, or English name"
            value={geo.mouzaSearch}
            onChange={(e) => geo.setMouzaSearch(e.target.value)}
            placeholder="Search Mouza by JL No (e.g. 114, 115), Bengali (গোয়ালী, কাইতলা), or English name..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Select / Deselect All Toggle Switch */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 px-1">
          <div className="text-right">
            <div className="text-xs font-semibold text-white">
              Select / Deselect All
            </div>
            <div className="text-[11px] font-mono-tabular text-slate-400">
              {geo.areAllMouzasSelected
                ? `All ${geo.allMouzasForUpazila.length} Mouzas Selected`
                : `${geo.selectedCount} of ${geo.allMouzasForUpazila.length} Selected (Manual Mode)`}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={geo.areAllMouzasSelected}
            aria-label="Select/Deselect All Mouzas for current Upazila"
            onClick={() => {
              if (geo.areAllMouzasSelected) {
                geo.deselectAll();
              } else {
                geo.selectAll100Percent();
              }
            }}
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              geo.areAllMouzasSelected ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                geo.areAllMouzasSelected ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mouza Chips & Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {geo.visibleMouzas.map((mouza) => {
          const isChecked = geo.selectedMouzaIds.includes(mouza.id);
          const isKaitalaSouth =
            mouza.unionNameEn === '20-No Kaitala South Union';
          return (
            <button
              key={mouza.id}
              type="button"
              onClick={() => geo.toggleMouza(mouza.id)}
              className={`p-3.5 rounded-xl border text-left transition-colors flex items-start gap-3 select-none ${
                isChecked
                  ? 'bg-slate-950 border-emerald-500/80 text-white'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono-tabular font-semibold text-emerald-400">
                    JL-{mouza.jlNo}
                  </span>
                  <span
                    className={`text-[10px] truncate ${
                      isKaitalaSouth
                        ? 'text-amber-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {mouza.unionNameBn || mouza.unionNameEn}
                  </span>
                </div>
                <div className="text-sm font-bold text-white font-bn truncate mt-0.5">
                  {mouza.nameBn} · {mouza.nameEn}
                </div>
                <div className="text-[11px] text-slate-400 font-mono-tabular mt-1">
                  {mouza.estimatedKhatians} Khatians · {mouza.estimatedDags} Dags
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
