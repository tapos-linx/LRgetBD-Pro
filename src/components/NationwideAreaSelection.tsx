import React, { useState } from 'react';
import {
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { UseCascadingGeoReturn } from '../hooks/useCascadingGeo';

interface CascadingDropdownProps {
  label: string;
  options: Array<{ id: string; nameEn: string; nameBn: string }>;
  selectedId: string | null;
  onIdSelected: (id: string) => void;
  isEnabled: boolean;
  isLoading?: boolean;
}

const CascadingDropdown: React.FC<CascadingDropdownProps> = ({
  label,
  options,
  selectedId,
  onIdSelected,
  isEnabled,
  isLoading,
}) => {
  const [expanded, setExpanded] = useState(false);
  const selected = options.find(o => o.id === selectedId);

  return (
    <div className="relative w-full">
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => isEnabled && !isLoading && setExpanded(!expanded)}
        disabled={!isEnabled || isLoading}
        className={`w-full px-3 py-2.5 rounded-lg bg-slate-950 border ${
          isEnabled ? 'border-slate-800' : 'border-slate-900 opacity-50'
        } text-xs text-white text-left flex justify-between items-center focus:outline-none focus:border-emerald-500`}
      >
        <span className="truncate">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
            </span>
          ) : (
            selected ? `${selected.nameBn} (${selected.nameEn})` : 'Select...'
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {expanded && isEnabled && (
        <div className="absolute z-50 w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              No options available.
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onIdSelected(option.id);
                  setExpanded(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-white hover:bg-slate-800 flex flex-col"
              >
                <span className="font-bn">{option.nameBn}</span>
                <span className="text-[10px] text-slate-400">{option.nameEn}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

interface NationwideAreaSelectionProps {
  geo: UseCascadingGeoReturn;
}

export const NationwideAreaSelection: React.FC<NationwideAreaSelectionProps> = ({ geo }) => {
  
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Nationwide Geographic Selection</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Verified Database Discovery (Division → District → Upazila → Mouza)</p>
        </div>
        {geo.isDiscovering && (
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Live Discovery Active
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CascadingDropdown
          label="১. বিভাগ (Division)"
          options={geo.divisions}
          selectedId={geo.selectedDivisionId}
          onIdSelected={geo.setSelectedDivisionId}
          isEnabled={!geo.isDiscovering}
        />

        <CascadingDropdown
          label="২. জেলা (District)"
          options={geo.districts}
          selectedId={geo.selectedDistrictId}
          onIdSelected={geo.setSelectedDistrictId}
          isEnabled={!!geo.selectedDivisionId && !geo.isDiscovering}
          isLoading={geo.isDiscovering && !!geo.selectedDivisionId && !geo.selectedDistrictId}
        />

        <CascadingDropdown
          label="৩. উপজেলা (Upazila)"
          options={geo.upazilas}
          selectedId={geo.selectedUpazilaId}
          onIdSelected={geo.setSelectedUpazilaId}
          isEnabled={!!geo.selectedDistrictId && !geo.isDiscovering}
          isLoading={geo.isDiscovering && !!geo.selectedDistrictId && !geo.selectedUpazilaId}
        />
      </div>

      {geo.discoveryStatus && (
        <div className={`p-3 rounded-lg border flex items-start gap-3 ${
          geo.discoveryStatus.includes('No') ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : 'bg-slate-950 border-slate-800 text-slate-300'
        }`}>
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium">{geo.discoveryStatus}</p>
            {geo.discoveryStatus.includes('No') && (
              <button 
                onClick={geo.retryDiscovery}
                className="mt-2 text-[10px] font-bold text-amber-400 flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Retry Discovery
              </button>
            )}
          </div>
        </div>
      )}

      {geo.activeUpazila && !geo.isDiscovering && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Mouza Discovery Successful</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono-tabular">
                Upazila: {geo.activeUpazila.nameEn} · Discovered: {geo.totalMouzasCount} · Selected: {geo.selectedCount}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={geo.deselectAll}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 hover:text-white"
              >
                Deselect All
              </button>
              <button
                onClick={geo.selectAllMouzas}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold hover:bg-emerald-600/30"
              >
                Select All Mouzas
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-900">
             <div className="flex items-center gap-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                <span>Verified Records</span>
                <span>Provenance: eporcha.tech</span>
                <span>Status: VERIFIED</span>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
