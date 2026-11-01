import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DistrictNode,
  DivisionNode,
  MouzaNode,
  UpazilaNode,
} from '../types/land';
import { GEO_HIERARCHY } from '../data/geoHierarchy';

export interface UseCascadingGeoReturn {
  // Cascading Selection State
  selectedDivisionId: string;
  selectedDistrictId: string;
  selectedUpazilaId: string;
  selectedUnion: string;
  mouzaSearch: string;
  selectedMouzaIds: string[];

  // Active Hierarchy Nodes
  activeDivision: DivisionNode;
  activeDistrict: DistrictNode;
  activeUpazila: UpazilaNode;
  allMouzasForUpazila: MouzaNode[];
  availableUnions: string[];
  visibleMouzas: MouzaNode[];
  areAllMouzasSelected: boolean;
  selectedCount: number;
  totalMouzasCount: number;

  // Actions
  setSelectedDivisionId: (divId: string) => void;
  setSelectedDistrictId: (distId: string) => void;
  setSelectedUpazilaId: (upzId: string) => void;
  setSelectedUnion: (union: string) => void;
  setMouzaSearch: (search: string) => void;
  setSelectedMouzaIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Fast Batch Controls
  selectAll100Percent: () => void;
  deselectAll: () => void;
  invertSelection: () => void;
  toggleMouza: (mouzaId: string) => void;
  selectUnionOnly: (unionName: string) => void;

  // Custom Mouza Import / Registration
  customMouzasByUpazila: Record<string, MouzaNode[]>;
  addCustomMouza: (mouza: Omit<MouzaNode, 'id'>) => MouzaNode;
  importCustomMouzasJsonOrCsv: (content: string) => number;
}

export function useCascadingGeo(): UseCascadingGeoReturn {
  const [selectedDivisionId, setSelectedDivisionIdState] = useState<string>(
    GEO_HIERARCHY[0].id
  );
  const [selectedDistrictId, setSelectedDistrictIdState] = useState<string>(
    GEO_HIERARCHY[0].districts[0].id
  );
  const [selectedUpazilaId, setSelectedUpazilaIdState] = useState<string>(
    GEO_HIERARCHY[0].districts[0].upazilas[0].id
  );
  const [selectedUnion, setSelectedUnionState] = useState<string>('ALL');
  const [mouzaSearch, setMouzaSearch] = useState<string>('');
  const [customMouzasByUpazila, setCustomMouzasByUpazila] = useState<
    Record<string, MouzaNode[]>
  >({});

  // Active Division
  const activeDivision = useMemo(() => {
    return (
      GEO_HIERARCHY.find((d) => d.id === selectedDivisionId) || GEO_HIERARCHY[0]
    );
  }, [selectedDivisionId]);

  // Active District
  const activeDistrict = useMemo(() => {
    return (
      activeDivision.districts.find((d) => d.id === selectedDistrictId) ||
      activeDivision.districts[0]
    );
  }, [activeDivision, selectedDistrictId]);

  // Active Upazila
  const activeUpazila = useMemo(() => {
    return (
      activeDistrict.upazilas.find((u) => u.id === selectedUpazilaId) ||
      activeDistrict.upazilas[0]
    );
  }, [activeDistrict, selectedUpazilaId]);

  // Combined Mouzas for Active Upazila (Pre-loaded authoritative dataset + custom registered)
  const allMouzasForUpazila = useMemo(() => {
    const customs = customMouzasByUpazila[activeUpazila.id] || [];
    return [...activeUpazila.mouzas, ...customs];
  }, [activeUpazila, customMouzasByUpazila]);

  // Available Unions in Active Upazila
  const availableUnions = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMouzasForUpazila) {
      if (m.unionNameEn) set.add(m.unionNameEn);
    }
    return Array.from(set);
  }, [allMouzasForUpazila]);

  // Filtered Mouzas according to union filter
  const unionFilteredMouzas = useMemo(() => {
    if (selectedUnion === 'ALL') return allMouzasForUpazila;
    return allMouzasForUpazila.filter((m) => m.unionNameEn === selectedUnion);
  }, [allMouzasForUpazila, selectedUnion]);

  // Selected Mouza IDs (Initial state: 100% of first Upazila's Mouzas)
  const [selectedMouzaIds, setSelectedMouzaIds] = useState<string[]>(() =>
    GEO_HIERARCHY[0].districts[0].upazilas[0].mouzas.map((m) => m.id)
  );

  // Mandatory 100% Auto-Mouza Selection Rule:
  // Whenever selectedUpazila or selectedUnion changes, automatically compute available Mouzas
  // and immediately set selectedMouzaIds to 100% of those Mouzas by default
  useEffect(() => {
    const allScopeIds = unionFilteredMouzas.map((m) => m.id);
    setSelectedMouzaIds(allScopeIds);
  }, [activeUpazila.id, selectedUnion]);

  // Visible Mouzas after live search by JL No., Bengali name, or English name
  const visibleMouzas = useMemo(() => {
    if (!mouzaSearch.trim()) return unionFilteredMouzas;
    const query = mouzaSearch.trim().toLowerCase();
    return unionFilteredMouzas.filter((m) => {
      return (
        m.jlNo.toLowerCase().includes(query) ||
        m.nameEn.toLowerCase().includes(query) ||
        m.nameBn.includes(mouzaSearch.trim()) ||
        m.unionNameEn.toLowerCase().includes(query) ||
        m.unionNameBn.includes(mouzaSearch.trim())
      );
    });
  }, [unionFilteredMouzas, mouzaSearch]);

  // Fast Batch Controls
  const selectAll100Percent = useCallback(() => {
    setSelectedMouzaIds(unionFilteredMouzas.map((m) => m.id));
  }, [unionFilteredMouzas]);

  const deselectAll = useCallback(() => {
    setSelectedMouzaIds([]);
  }, []);

  const invertSelection = useCallback(() => {
    setSelectedMouzaIds((prev) => {
      const prevSet = new Set(prev);
      return unionFilteredMouzas
        .filter((m) => !prevSet.has(m.id))
        .map((m) => m.id);
    });
  }, [unionFilteredMouzas]);

  const toggleMouza = useCallback((mouzaId: string) => {
    setSelectedMouzaIds((prev) =>
      prev.includes(mouzaId)
        ? prev.filter((id) => id !== mouzaId)
        : [...prev, mouzaId]
    );
  }, []);

  const selectUnionOnly = useCallback(
    (unionName: string) => {
      setSelectedUnionState(unionName);
      const matching = allMouzasForUpazila.filter(
        (m) => unionName === 'ALL' || m.unionNameEn === unionName
      );
      setSelectedMouzaIds(matching.map((m) => m.id));
    },
    [allMouzasForUpazila]
  );

  // Cascading Selection Handlers
  const setSelectedDivisionId = useCallback((divId: string) => {
    setSelectedDivisionIdState(divId);
    const div = GEO_HIERARCHY.find((d) => d.id === divId) || GEO_HIERARCHY[0];
    const firstDist = div.districts[0];
    const firstUpz = firstDist.upazilas[0];
    setSelectedDistrictIdState(firstDist.id);
    setSelectedUpazilaIdState(firstUpz.id);
    setSelectedUnionState('ALL');
    setMouzaSearch('');
  }, []);

  const setSelectedDistrictId = useCallback(
    (distId: string) => {
      setSelectedDistrictIdState(distId);
      const dist =
        activeDivision.districts.find((d) => d.id === distId) ||
        activeDivision.districts[0];
      const firstUpz = dist.upazilas[0];
      setSelectedUpazilaIdState(firstUpz.id);
      setSelectedUnionState('ALL');
      setMouzaSearch('');
    },
    [activeDivision]
  );

  const setSelectedUpazilaId = useCallback((upzId: string) => {
    setSelectedUpazilaIdState(upzId);
    setSelectedUnionState('ALL');
    setMouzaSearch('');
  }, []);

  const setSelectedUnion = useCallback((union: string) => {
    setSelectedUnionState(union);
  }, []);

  // Custom Mouza Registration
  const addCustomMouza = useCallback(
    (mouza: Omit<MouzaNode, 'id'>): MouzaNode => {
      const id = `mz-custom-${activeUpazila.id}-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`;
      const fullMouza: MouzaNode = { ...mouza, id };
      setCustomMouzasByUpazila((prev) => ({
        ...prev,
        [activeUpazila.id]: [...(prev[activeUpazila.id] || []), fullMouza],
      }));
      setSelectedMouzaIds((prev) => [...prev, id]);
      return fullMouza;
    },
    [activeUpazila.id]
  );

  // Custom Mouza CSV / JSON Batch Import
  const importCustomMouzasJsonOrCsv = useCallback(
    (content: string): number => {
      let importedCount = 0;
      const trimmed = content.trim();
      const newNodes: MouzaNode[] = [];

      try {
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          const parsed = JSON.parse(trimmed);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          list.forEach((item, idx) => {
            if (item.jlNo && (item.nameEn || item.nameBn)) {
              newNodes.push({
                id: `mz-import-${activeUpazila.id}-${Date.now()}-${idx}`,
                jlNo: String(item.jlNo).trim(),
                nameEn: item.nameEn?.trim() || `Mouza-${item.jlNo}`,
                nameBn: item.nameBn?.trim() || item.nameEn?.trim() || '',
                unionNameEn: item.unionNameEn?.trim() || 'Imported Union',
                unionNameBn: item.unionNameBn?.trim() || 'ইমপোর্টেড ইউনিয়ন',
                availableSurveys: item.availableSurveys || [
                  'CS',
                  'SA',
                  'RS',
                  'BS',
                  'MUTATION',
                ],
                estimatedKhatians: Number(item.estimatedKhatians) || 300,
                estimatedDags: Number(item.estimatedDags) || 750,
                mapSheets: item.mapSheets || [1],
              });
              importedCount++;
            }
          });
        } else {
          // CSV Parsing (jlNo, nameEn, nameBn, unionNameEn)
          const lines = trimmed.split(/\r?\n/);
          lines.forEach((line, idx) => {
            const parts = line.split(',').map((p) => p.trim());
            if (parts.length >= 2 && parts[0] && parts[1]) {
              newNodes.push({
                id: `mz-csv-${activeUpazila.id}-${Date.now()}-${idx}`,
                jlNo: parts[0],
                nameEn: parts[1],
                nameBn: parts[2] || parts[1],
                unionNameEn: parts[3] || 'Imported Union',
                unionNameBn: parts[3] || 'ইমপোর্টেড ইউনিয়ন',
                availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'],
                estimatedKhatians: 300,
                estimatedDags: 750,
                mapSheets: [1],
              });
              importedCount++;
            }
          });
        }

        if (newNodes.length > 0) {
          setCustomMouzasByUpazila((prev) => ({
            ...prev,
            [activeUpazila.id]: [...(prev[activeUpazila.id] || []), ...newNodes],
          }));
          setSelectedMouzaIds((prev) => [
            ...prev,
            ...newNodes.map((n) => n.id),
          ]);
        }
      } catch (err) {
        console.error('Failed to import custom mouzas:', err);
      }

      return importedCount;
    },
    [activeUpazila.id]
  );

  const areAllMouzasSelected =
    unionFilteredMouzas.length > 0 &&
    unionFilteredMouzas.every((m) => selectedMouzaIds.includes(m.id));

  return {
    selectedDivisionId,
    selectedDistrictId,
    selectedUpazilaId,
    selectedUnion,
    mouzaSearch,
    selectedMouzaIds,

    activeDivision,
    activeDistrict,
    activeUpazila,
    allMouzasForUpazila,
    availableUnions,
    visibleMouzas,
    areAllMouzasSelected,
    selectedCount: selectedMouzaIds.length,
    totalMouzasCount: allMouzasForUpazila.length,

    setSelectedDivisionId,
    setSelectedDistrictId,
    setSelectedUpazilaId,
    setSelectedUnion,
    setMouzaSearch,
    setSelectedMouzaIds,

    selectAll100Percent,
    deselectAll,
    invertSelection,
    toggleMouza,
    selectUnionOnly,

    customMouzasByUpazila,
    addCustomMouza,
    importCustomMouzasJsonOrCsv,
  };
}
