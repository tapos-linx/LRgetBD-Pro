import React, { useState } from 'react';
import {
  ChevronDown,
} from 'lucide-react';
import { UseCascadingGeoReturn } from '../hooks/useCascadingGeo';

interface CascadingDropdownProps {
  label: string;
  options: string[];
  selectedOption: string | null;
  onOptionSelected: (option: string) => void;
  isEnabled: boolean;
}

const CascadingDropdown: React.FC<CascadingDropdownProps> = ({
  label,
  options,
  selectedOption,
  onOptionSelected,
  isEnabled,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative w-full">
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => isEnabled && setExpanded(!expanded)}
        disabled={!isEnabled}
        className={`w-full px-3 py-2.5 rounded-lg bg-slate-950 border ${
          isEnabled ? 'border-slate-800' : 'border-slate-900 opacity-50'
        } text-xs text-white text-left flex justify-between items-center focus:outline-none focus:border-emerald-500`}
      >
        <span>{selectedOption || 'Select...'}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {expanded && isEnabled && (
        <div className="absolute z-50 w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onOptionSelected(option);
                setExpanded(false);
              }}
              className="w-full px-3 py-2 text-left text-xs text-white hover:bg-slate-800"
            >
              {option}
            </button>
          ))}
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
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <h2 className="text-sm font-semibold text-white">Nationwide Area Selection</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CascadingDropdown
          label="বিভাগ (Division)"
          options={geo.hierarchy.map(d => d.nameEn)}
          selectedOption={geo.activeDivision.nameEn}
          onOptionSelected={(val) => {
             const div = geo.hierarchy.find(d => d.nameEn === val);
             if (div) geo.setSelectedDivisionId(div.id);
          }}
          isEnabled={true}
        />

        <CascadingDropdown
          label="জেলা (District)"
          options={geo.activeDivision.districts.map(d => d.nameEn)}
          selectedOption={geo.activeDistrict.nameEn}
          onOptionSelected={(val) => {
             const dist = geo.activeDivision.districts.find(d => d.nameEn === val);
             if (dist) geo.setSelectedDistrictId(dist.id);
          }}
          isEnabled={true}
        />

        <CascadingDropdown
          label="উপজেলা (Upazila)"
          options={geo.activeDistrict.upazilas.map(u => u.nameEn)}
          selectedOption={geo.activeUpazila.nameEn}
          onOptionSelected={(val) => {
             const upz = geo.activeDistrict.upazilas.find(u => u.nameEn === val);
             if (upz) geo.setSelectedUpazilaId(upz.id);
          }}
          isEnabled={true}
        />
      </div>

      {geo.activeUpazila && geo.selectedCount > 0 && (
        <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-500/30 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-emerald-100">
              Total Mouzas Found: {geo.selectedCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-[10px] text-white font-bold">
              Auto-Selected
            </span>
          </div>
          
          <button
            onClick={() => geo.areAllMouzasSelected ? geo.deselectAll() : geo.selectAll100Percent()}
            className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-xs text-white font-semibold hover:bg-emerald-500"
          >
            {geo.areAllMouzasSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}
    </div>
  );
};
