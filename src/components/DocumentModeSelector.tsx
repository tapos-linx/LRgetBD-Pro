import React from 'react';
import {
  BookOpen,
  CheckSquare,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Layers,
  Map as MapIcon,
  Palette,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  ALL_ENDPOINT_TYPES,
  ALL_SURVEY_TYPES,
  ENDPOINT_MODE_META,
  SURVEY_LABELS,
} from '../data/geoHierarchy';
import {
  BookStyleConfig,
  EporchaEndpointType,
  SurveyType,
} from '../types/land';

interface DocumentModeSelectorProps {
  selectedEndpoints: EporchaEndpointType[];
  onEndpointsChange: (endpoints: EporchaEndpointType[]) => void;
  selectedSurveys: SurveyType[];
  onSurveysChange: (surveys: SurveyType[]) => void;
  bookStyle: BookStyleConfig;
  onBookStyleChange: (style: BookStyleConfig) => void;
  khatianInput: string;
  onKhatianInputChange: (val: string) => void;
  mapSheetInput: number;
  onMapSheetInputChange: (val: number) => void;
  selectedMouzaCount: number;
  onSelectAllAndFetch?: () => void;
  disabled?: boolean;
}

export const DocumentModeSelector: React.FC<DocumentModeSelectorProps> = ({
  selectedEndpoints,
  onEndpointsChange,
  selectedSurveys,
  onSurveysChange,
  bookStyle,
  onBookStyleChange,
  khatianInput,
  onKhatianInputChange,
  mapSheetInput,
  onMapSheetInputChange,
  selectedMouzaCount,
  onSelectAllAndFetch,
  disabled = false,
}) => {
  // Toggle individual endpoint
  const handleToggleEndpoint = (endpoint: EporchaEndpointType) => {
    if (disabled) return;
    if (selectedEndpoints.includes(endpoint)) {
      if (selectedEndpoints.length > 1) {
        onEndpointsChange(selectedEndpoints.filter((e) => e !== endpoint));
      }
    } else {
      onEndpointsChange([...selectedEndpoints, endpoint]);
    }
  };

  // Toggle individual survey
  const handleToggleSurvey = (survey: SurveyType) => {
    if (disabled) return;
    if (selectedSurveys.includes(survey)) {
      if (selectedSurveys.length > 1) {
        onSurveysChange(selectedSurveys.filter((s) => s !== survey));
      }
    } else {
      onSurveysChange([...selectedSurveys, survey]);
    }
  };

  // Fast Batch: Select all 5 endpoints
  const handleSelectAllEndpoints = () => {
    if (disabled) return;
    onEndpointsChange([...ALL_ENDPOINT_TYPES]);
  };

  // Fast Batch: Select all surveys
  const handleSelectAllSurveys = () => {
    if (disabled) return;
    onSurveysChange([...ALL_SURVEY_TYPES]);
  };

  // Fast Batch: RS + BS Recommended
  const handleSelectRecommendedSurveys = () => {
    if (disabled) return;
    onSurveysChange(['RS', 'BS']);
  };

  // Computed Cartesian product
  const estimatedTasks =
    selectedMouzaCount * selectedEndpoints.length * selectedSurveys.length;

  const getEndpointIcon = (endpoint: EporchaEndpointType) => {
    switch (endpoint) {
      case 'mouza-vittik-khatian':
        return <BookOpen className="w-5 h-5" />;
      case 'mouza-vittik-dag':
        return <FileSpreadsheet className="w-5 h-5" />;
      case 'survey-khatian':
        return <FileText className="w-5 h-5" />;
      case 'namjari-khatian':
        return <FileCheck2 className="w-5 h-5" />;
      case 'mouza-map':
        return <MapIcon className="w-5 h-5" />;
      case 'khatian-index':
        return <FileSpreadsheet className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-6">
      {/* Header with Title and Global Auto-Fetch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Document & Survey Matrix
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                eporcha.tech Direct
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              নথি নির্বাচন — 6 Types of Land Records: Khatian Books, Dag Index, Individual Khatians, Namjari, Maps & Khatian Index
            </p>
          </div>
        </div>

        {onSelectAllAndFetch && (
          <button
            type="button"
            onClick={onSelectAllAndFetch}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Auto-selects 100% Mouzas, all 6 document modes, all survey types and enqueues tasks immediately"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Select All 6 Modes & Auto-Fetch</span>
          </button>
        )}
      </div>

      {/* 1. Document Mode Selection (6 eporcha.tech endpoints) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>1. Document Types ({selectedEndpoints.length}/6 Active)</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllEndpoints}
              disabled={disabled || selectedEndpoints.length === ALL_ENDPOINT_TYPES.length}
              className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer disabled:opacity-40 disabled:no-underline"
            >
              Select All 6 Modes
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => onEndpointsChange(['mouza-vittik-khatian'])}
              disabled={disabled || (selectedEndpoints.length === 1 && selectedEndpoints[0] === 'mouza-vittik-khatian')}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700 cursor-pointer disabled:opacity-40"
            >
              Reset to Khatian Book
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {ALL_ENDPOINT_TYPES.map((endpoint) => {
            const meta = ENDPOINT_MODE_META[endpoint];
            const isSelected = selectedEndpoints.includes(endpoint);
            return (
              <button
                key={endpoint}
                type="button"
                onClick={() => handleToggleEndpoint(endpoint)}
                disabled={disabled}
                className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/70 text-slate-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {getEndpointIcon(endpoint)}
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <CheckSquare className="w-3 h-3" />}
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {meta.titleBn}
                </span>
                <span className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">
                  {meta.titleEn}
                </span>
                <span className="text-[10px] text-emerald-800 font-mono mt-2 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                  {meta.badgeBn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Survey Types Matrix */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>2. Survey Types ({selectedSurveys.length}/5 Active)</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllSurveys}
              disabled={disabled || selectedSurveys.length === ALL_SURVEY_TYPES.length}
              className="text-[11px] font-medium text-teal-700 hover:text-teal-800 hover:underline cursor-pointer disabled:opacity-40 disabled:no-underline"
            >
              Select All (CS, SA, RS, BS, Mutation)
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleSelectRecommendedSurveys}
              disabled={disabled}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700 cursor-pointer disabled:opacity-40"
            >
              RS + BS Only
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {ALL_SURVEY_TYPES.map((survey) => {
            const isSelected = selectedSurveys.includes(survey);
            return (
              <button
                key={survey}
                type="button"
                onClick={() => handleToggleSurvey(survey)}
                disabled={disabled}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="font-bold">{survey}</span>
                  <span className="block text-[10px] font-normal text-slate-500">
                    {SURVEY_LABELS[survey].labelBn}
                  </span>
                </div>
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    isSelected
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Book Layout, Color Mode & Scope Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
        {/* Book Layout */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Book Layout Format</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onBookStyleChange({ ...bookStyle, layout: 'new' })}
              disabled={disabled}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                bookStyle.layout === 'new'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Format (আধুনিক)
            </button>
            <button
              type="button"
              onClick={() => onBookStyleChange({ ...bookStyle, layout: 'old' })}
              disabled={disabled}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                bookStyle.layout === 'old'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Old Format (প্রাচীন)
            </button>
          </div>
        </div>

        {/* Color Mode */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-slate-500" />
            <span>Color Profile</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onBookStyleChange({ ...bookStyle, colorMode: 'color' })}
              disabled={disabled}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                bookStyle.colorMode === 'color'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Color (রঙিন)
            </button>
            <button
              type="button"
              onClick={() => onBookStyleChange({ ...bookStyle, colorMode: 'bw' })}
              disabled={disabled}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                bookStyle.colorMode === 'bw'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              B&W (সাদা-কালো)
            </button>
          </div>
        </div>

        {/* Optional Range / Map Sheet */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-slate-500" />
            <span>Target Khatian Range / Sheet</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={khatianInput}
              onChange={(e) => onKhatianInputChange(e.target.value)}
              disabled={disabled}
              placeholder="ALL or 1-50, 102"
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              title="Khatian number or range filter"
            />
            {selectedEndpoints.includes('mouza-map') && (
              <input
                type="number"
                min={1}
                max={50}
                value={mapSheetInput}
                onChange={(e) => onMapSheetInputChange(parseInt(e.target.value, 10) || 1)}
                disabled={disabled}
                placeholder="Sheet"
                className="w-16 px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                title="Map Sheet Number"
              />
            )}
          </div>
        </div>
      </div>

      {/* Cartesian Matrix Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">Cartesian Queue Matrix:</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-emerald-800 font-bold">
            {selectedMouzaCount} Mouzas
          </span>
          <span className="text-slate-400">×</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-teal-800 font-bold">
            {selectedEndpoints.length} Modes
          </span>
          <span className="text-slate-400">×</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-indigo-800 font-bold">
            {selectedSurveys.length} Surveys
          </span>
          <span className="text-slate-400">=</span>
          <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-mono font-bold shadow-xs">
            {estimatedTasks} Total Download Tasks
          </span>
        </div>

        <div className="text-[11px] text-slate-500 italic">
          100% Mouza Auto-Selection Active
        </div>
      </div>
    </div>
  );
};
