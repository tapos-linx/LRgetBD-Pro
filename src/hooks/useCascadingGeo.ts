import React, { useCallback, useMemo, useState } from 'react';
import {
  DistrictNode,
  DivisionNode,
  MouzaNode,
  UpazilaNode,
} from '../types/land';
import { BANGLADESH_NATIONWIDE_HIERARCHY } from '../data/bangladeshNationwideHierarchy';
import { geoDiscovery } from '../services/geoDiscoveryService';
import { geoDb } from '../services/geographicDbService';

export interface UseCascadingGeoReturn {
  // Cascading Selection State
  selectedDivisionId: string | null;
  selectedDistrictId: string | null;
  selectedUpazilaId: string | null;
  selectedUnion: string;
  mouzaSearch: string;
  selectedMouzaIds: string[];
  customMouzasByUpazila: Record<string, MouzaNode[]>;

  // Data Lists
  divisions: DivisionNode[];
  districts: DistrictNode[];
  upazilas: UpazilaNode[];
  allMouzasForUpazila: MouzaNode[];

  // Status
  isDiscovering: boolean;
  discoveryStatus: string | null;

  // Active Hierarchy Nodes
  activeDivision: DivisionNode | null;
  activeDistrict: DistrictNode | null;
  activeUpazila: UpazilaNode | null;
  availableUnions: string[];
  visibleMouzas: MouzaNode[];
  areAllMouzasSelected: boolean;
  selectedCount: number;
  totalMouzasCount: number;

  // Actions
  setSelectedDivisionId: (divId: string | null) => Promise<void>;
  setSelectedDistrictId: (distId: string | null) => Promise<void>;
  setSelectedUpazilaId: (upzId: string | null) => Promise<void>;
  setSelectedUnion: (union: string) => void;
  setMouzaSearch: (search: string) => void;
  setSelectedMouzaIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Fast Batch Controls
  selectAllMouzas: () => void;
  selectAll100Percent: () => void;
  deselectAll: () => void;
  invertSelection: () => void;
  toggleMouza: (mouzaId: string) => void;
  selectUnionOnly: (unionName: string) => void;
  addCustomMouza: (mouzaInput: Omit<MouzaNode, 'id'>) => MouzaNode | null;
  importCustomMouzasJsonOrCsv: (rawText: string) => number;

  // Discovery Trigger
  retryDiscovery: () => void;
}

export function useCascadingGeo(): UseCascadingGeoReturn {
  const divisions = BANGLADESH_NATIONWIDE_HIERARCHY;
  const initialDivision = divisions[0] || null;
  const initialDistrict = initialDivision?.districts[0] || null;
  const initialUpazila = initialDistrict?.upazilas[0] || null;
  const initialMouzas = initialUpazila ? [...initialUpazila.mouzas] : [];

  const [selectedDivisionId, setSelectedDivisionIdState] = useState<string | null>(
    initialDivision?.id || null
  );
  const [selectedDistrictId, setSelectedDistrictIdState] = useState<string | null>(
    initialDistrict?.id || null
  );
  const [selectedUpazilaId, setSelectedUpazilaIdState] = useState<string | null>(
    initialUpazila?.id || null
  );
  const [selectedUnion, setSelectedUnion] = useState<string>('ALL');
  const [mouzaSearch, setMouzaSearch] = useState<string>('');
  const [customMouzasByUpazila, setCustomMouzasByUpazila] = useState<
    Record<string, MouzaNode[]>
  >({});

  const [districts, setDistricts] = useState<DistrictNode[]>(
    initialDivision ? [...initialDivision.districts] : []
  );
  const [upazilas, setUpazilas] = useState<UpazilaNode[]>(
    initialDistrict ? [...initialDistrict.upazilas] : []
  );
  const [mouzas, setMouzas] = useState<MouzaNode[]>(initialMouzas);

  // Initialize selectedMouzaIds with ALL Mouza IDs of the initial Upazila (no slice or cap)
  const [selectedMouzaIds, setSelectedMouzaIds] = useState<string[]>(() =>
    initialMouzas.map((m) => m.id)
  );

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);

  // Active Division
  const activeDivision = useMemo(() => {
    return divisions.find((d) => d.id === selectedDivisionId) || null;
  }, [selectedDivisionId, divisions]);

  // Active District
  const activeDistrict = useMemo(() => {
    return districts.find((d) => d.id === selectedDistrictId) || null;
  }, [selectedDistrictId, districts]);

  // Active Upazila
  const activeUpazila = useMemo(() => {
    return upazilas.find((u) => u.id === selectedUpazilaId) || null;
  }, [selectedUpazilaId, upazilas]);

  // Combined Mouzas for the active Upazila (full discovered list + any custom Mouzas, zero slice/length cap)
  const allMouzasForUpazila = useMemo(() => {
    if (!selectedUpazilaId) return mouzas;
    const customList = customMouzasByUpazila[selectedUpazilaId] || [];
    if (customList.length === 0) return mouzas;
    const existingIds = new Set(mouzas.map((m) => m.id));
    return [
      ...mouzas,
      ...customList.filter((cm) => !existingIds.has(cm.id)),
    ];
  }, [mouzas, customMouzasByUpazila, selectedUpazilaId]);

  // Available Unions
  const availableUnions = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMouzasForUpazila) {
      if (m.unionNameEn) set.add(m.unionNameEn);
    }
    return Array.from(set).sort();
  }, [allMouzasForUpazila]);

  // Filtered Mouzas by Union (only for optional union filtering in view)
  const unionFilteredMouzas = useMemo(() => {
    if (selectedUnion === 'ALL') return allMouzasForUpazila;
    return allMouzasForUpazila.filter((m) => m.unionNameEn === selectedUnion);
  }, [allMouzasForUpazila, selectedUnion]);

  // Helper to build deduplicated Mouza list and IDs without any slice or length limit
  const buildFullMouzaSelection = useCallback(
    (rawList: MouzaNode[], upzId: string) => {
      const fullMouzaList: MouzaNode[] = [];
      const allMouzaIds: string[] = [];
      const seenIds = new Set<string>();

      for (const mouza of rawList) {
        if (!seenIds.has(mouza.id)) {
          seenIds.add(mouza.id);
          fullMouzaList.push(mouza);
          allMouzaIds.push(mouza.id);
        }
      }

      const customList = customMouzasByUpazila[upzId] || [];
      for (const customMouza of customList) {
        if (!seenIds.has(customMouza.id)) {
          seenIds.add(customMouza.id);
          fullMouzaList.push(customMouza);
          allMouzaIds.push(customMouza.id);
        }
      }

      return { fullMouzaList, allMouzaIds };
    },
    [customMouzasByUpazila]
  );

  // 1. Upazila Selection Handler — Fetches ALL Mouzas from eporcha.tech URL, shows the count, and auto-selects 100% of discovered Mouzas
  const handleUpazilaChange = useCallback(
    async (upzId: string | null) => {
      setSelectedUpazilaIdState(upzId);
      setSelectedUnion('ALL');
      setMouzaSearch('');

      if (!upzId) {
        setMouzas([]);
        setSelectedMouzaIds([]);
        setDiscoveryStatus(null);
        return;
      }

      // Check if authoritative in-memory record has mouzas (e.g., Nabinagar 176 verified Mouzas)
      let authUpz: UpazilaNode | null =
        upazilas.find((u) => u.id === upzId) || null;
      if (!authUpz) {
        for (const div of divisions) {
          for (const dist of div.districts) {
            const match = dist.upazilas.find((u) => u.id === upzId);
            if (match) {
              authUpz = match;
              break;
            }
          }
          if (authUpz) break;
        }
      }

      const upzName = authUpz?.nameEn || upzId.replace(/^upz-/, '');

      if (authUpz && authUpz.mouzas.length > 0) {
        const { fullMouzaList, allMouzaIds } = buildFullMouzaSelection(
          authUpz.mouzas,
          upzId
        );
        setMouzas(fullMouzaList);
        setSelectedMouzaIds(allMouzaIds);
        setDiscoveryStatus(
          `Found ${fullMouzaList.length} Mouzas for ${upzName} (Authoritative Record). Auto-selected all ${allMouzaIds.length} Mouzas (100%).`
        );
        setIsDiscovering(false);
        return;
      }

      setIsDiscovering(true);
      setDiscoveryStatus(`Querying eporcha.tech URL for Mouzas in ${upzName}...`);

      try {
        const summary = await geoDiscovery.queryMouzasFromPortalUrl(
          upzId,
          selectedDistrictId
        );
        const { fullMouzaList, allMouzaIds } = buildFullMouzaSelection(
          summary.mouzas,
          upzId
        );

        setMouzas(fullMouzaList);
        // Auto-select ALL discovered Mouza IDs (100%)
        setSelectedMouzaIds(allMouzaIds);

        if (summary.totalFound > 0) {
          setDiscoveryStatus(
            `Found ${summary.totalFound} Mouzas for ${summary.upazilaNameEn || upzName} from eporcha.tech URL. Auto-selected all ${allMouzaIds.length} Mouzas (100%).`
          );
        } else {
          setDiscoveryStatus(
            `No Mouza records found for ${upzName} from URL.`
          );
        }
      } catch (err) {
        console.error('Mouza URL Discovery Failed:', err);
        setDiscoveryStatus(`Failed to fetch Mouzas for ${upzName} from URL.`);
      } finally {
        setIsDiscovering(false);
      }
    },
    [upazilas, divisions, selectedDistrictId, buildFullMouzaSelection]
  );

  // 2. District Selection Handler — Cascades and fetches all Mouzas for first Upazila
  const handleDistrictChange = useCallback(
    async (distId: string | null) => {
      setSelectedDistrictIdState(distId);
      setSelectedUnion('ALL');
      setMouzaSearch('');

      if (!distId) {
        setSelectedUpazilaIdState(null);
        setUpazilas([]);
        setMouzas([]);
        setSelectedMouzaIds([]);
        return;
      }

      let authDist: DistrictNode | null =
        districts.find((d) => d.id === distId) || null;
      if (!authDist || authDist.upazilas.length === 0) {
        for (const div of divisions) {
          const match = div.districts.find((d) => d.id === distId);
          if (match) {
            authDist = match;
            break;
          }
        }
      }

      if (authDist && authDist.upazilas.length > 0) {
        const nextUpazilas = [...authDist.upazilas];
        const firstUpz = nextUpazilas[0] || null;
        setUpazilas(nextUpazilas);
        setSelectedUpazilaIdState(firstUpz?.id || null);

        if (firstUpz) {
          await handleUpazilaChange(firstUpz.id);
          return;
        }
      }

      setIsDiscovering(true);
      setDiscoveryStatus('Fetching upazilas from portal...');
      const discoveredUpazilas = await geoDiscovery.discoverUpazilas(distId);
      setUpazilas(discoveredUpazilas);
      setIsDiscovering(false);
      if (discoveredUpazilas.length > 0) {
        await handleUpazilaChange(discoveredUpazilas[0].id);
      } else {
        setDiscoveryStatus('No upazilas found for this district.');
      }
    },
    [districts, divisions, handleUpazilaChange]
  );

  // 3. Division Selection Handler — Cascades down to first District and first Upazila
  const handleDivisionChange = useCallback(
    async (divId: string | null) => {
      setSelectedDivisionIdState(divId);
      setSelectedUnion('ALL');
      setMouzaSearch('');

      if (!divId) {
        setSelectedDistrictIdState(null);
        setSelectedUpazilaIdState(null);
        setDistricts([]);
        setUpazilas([]);
        setMouzas([]);
        setSelectedMouzaIds([]);
        return;
      }

      const authDiv = divisions.find((d) => d.id === divId) || null;
      if (authDiv && authDiv.districts.length > 0) {
        const nextDistricts = [...authDiv.districts];
        const firstDist = nextDistricts[0];
        const nextUpazilas = firstDist ? [...firstDist.upazilas] : [];
        const firstUpz = nextUpazilas[0] || null;

        setDistricts(nextDistricts);
        setSelectedDistrictIdState(firstDist?.id || null);
        setUpazilas(nextUpazilas);
        setSelectedUpazilaIdState(firstUpz?.id || null);

        if (firstUpz) {
          await handleUpazilaChange(firstUpz.id);
          return;
        }
      }

      setIsDiscovering(true);
      setDiscoveryStatus('Fetching districts...');
      const discoveredDistricts = await geoDiscovery.discoverDistricts(divId);
      setDistricts(discoveredDistricts);
      setIsDiscovering(false);
      if (discoveredDistricts.length > 0) {
        await handleDistrictChange(discoveredDistricts[0].id);
      } else {
        setDiscoveryStatus('No districts found for this division.');
      }
    },
    [divisions, handleUpazilaChange, handleDistrictChange]
  );

  const retryDiscovery = useCallback(() => {
    if (selectedUpazilaId) void handleUpazilaChange(selectedUpazilaId);
    else if (selectedDistrictId) void handleDistrictChange(selectedDistrictId);
    else if (selectedDivisionId) void handleDivisionChange(selectedDivisionId);
  }, [
    selectedDivisionId,
    selectedDistrictId,
    selectedUpazilaId,
    handleDivisionChange,
    handleDistrictChange,
    handleUpazilaChange,
  ]);

  // Visible Mouzas (no slice or length limit)
  const visibleMouzas = useMemo(() => {
    if (!mouzaSearch.trim()) return unionFilteredMouzas;
    const query = mouzaSearch.trim().toLowerCase();
    return unionFilteredMouzas.filter((m) => {
      return (
        m.jlNo.toLowerCase().includes(query) ||
        m.nameEn.toLowerCase().includes(query) ||
        m.nameBn.includes(mouzaSearch.trim())
      );
    });
  }, [unionFilteredMouzas, mouzaSearch]);

  const areAllMouzasSelected =
    allMouzasForUpazila.length > 0 &&
    allMouzasForUpazila.every((m) => selectedMouzaIds.includes(m.id));

  // Select All Mouzas across the entire active Upazila without any slice or filter restriction
  const selectAllMouzas = useCallback(() => {
    setSelectedUnion('ALL');
    setSelectedMouzaIds(allMouzasForUpazila.map((m) => m.id));
  }, [allMouzasForUpazila]);

  const deselectAll = useCallback(() => {
    setSelectedMouzaIds([]);
  }, []);

  const invertSelection = useCallback(() => {
    setSelectedMouzaIds((prev) => {
      const prevSet = new Set(prev);
      return allMouzasForUpazila
        .filter((m) => !prevSet.has(m.id))
        .map((m) => m.id);
    });
  }, [allMouzasForUpazila]);

  const toggleMouza = useCallback((mouzaId: string) => {
    setSelectedMouzaIds((prev) =>
      prev.includes(mouzaId)
        ? prev.filter((id) => id !== mouzaId)
        : [...prev, mouzaId]
    );
  }, []);

  const selectUnionOnly = useCallback(
    (unionName: string) => {
      setSelectedUnion(unionName);
      const matching = allMouzasForUpazila.filter(
        (m) => unionName === 'ALL' || m.unionNameEn === unionName
      );
      setSelectedMouzaIds(matching.map((m) => m.id));
    },
    [allMouzasForUpazila]
  );

  const addCustomMouza = useCallback(
    (mouzaInput: Omit<MouzaNode, 'id'>): MouzaNode | null => {
      if (!selectedUpazilaId) return null;
      const newMouza: MouzaNode = {
        ...mouzaInput,
        id: `mz-custom-${selectedUpazilaId}-${mouzaInput.jlNo}-${Date.now()}`,
      };
      setCustomMouzasByUpazila((prev) => ({
        ...prev,
        [selectedUpazilaId]: [...(prev[selectedUpazilaId] || []), newMouza],
      }));
      setSelectedMouzaIds((prev) =>
        prev.includes(newMouza.id) ? prev : [...prev, newMouza.id]
      );
      return newMouza;
    },
    [selectedUpazilaId]
  );

  const importCustomMouzasJsonOrCsv = useCallback(
    (rawText: string): number => {
      if (!selectedUpazilaId || !rawText.trim()) return 0;
      const trimmed = rawText.trim();
      const imported: MouzaNode[] = [];

      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            parsed.forEach((item, idx) => {
              const jlNo = String(item.jlNo || item.jl_no || idx + 1).trim();
              const nameEn = String(item.nameEn || item.name_en || `Mouza ${jlNo}`).trim();
              const nameBn = String(item.nameBn || item.name_bn || nameEn).trim();
              imported.push({
                id: `mz-import-${selectedUpazilaId}-${jlNo}-${Date.now()}-${idx}`,
                jlNo,
                nameEn,
                nameBn,
                unionNameEn: String(item.unionNameEn || item.union_en || 'Imported Union'),
                unionNameBn: String(item.unionNameBn || item.union_bn || 'ইমপোর্টেড ইউনিয়ন'),
                availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'],
                estimatedKhatians: 500,
                estimatedDags: 1200,
                mapSheets: [1],
              });
            });
          }
        } catch {
          // Fall through to CSV parser
        }
      }

      if (imported.length === 0) {
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        lines.forEach((line, idx) => {
          const parts = line.split(',').map((p) => p.trim());
          if (parts.length >= 2) {
            const [jlNo, nameEn, nameBn, unionEn] = parts;
            imported.push({
              id: `mz-import-${selectedUpazilaId}-${jlNo}-${Date.now()}-${idx}`,
              jlNo,
              nameEn,
              nameBn: nameBn || nameEn,
              unionNameEn: unionEn || 'Imported Union',
              unionNameBn: unionEn || 'ইমপোর্টেড ইউনিয়ন',
              availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'],
              estimatedKhatians: 500,
              estimatedDags: 1200,
              mapSheets: [1],
            });
          }
        });
      }

      if (imported.length > 0) {
        setCustomMouzasByUpazila((prev) => ({
          ...prev,
          [selectedUpazilaId]: [...(prev[selectedUpazilaId] || []), ...imported],
        }));
        setSelectedMouzaIds((prev) => [
          ...new Set([...prev, ...imported.map((m) => m.id)]),
        ]);
      }

      return imported.length;
    },
    [selectedUpazilaId]
  );

  return {
    selectedDivisionId,
    selectedDistrictId,
    selectedUpazilaId,
    selectedUnion,
    mouzaSearch,
    selectedMouzaIds,
    customMouzasByUpazila,

    divisions,
    districts,
    upazilas,
    allMouzasForUpazila,

    isDiscovering,
    discoveryStatus,

    activeDivision,
    activeDistrict,
    activeUpazila,
    availableUnions,
    visibleMouzas,
    areAllMouzasSelected,
    selectedCount: selectedMouzaIds.length,
    totalMouzasCount: allMouzasForUpazila.length,

    setSelectedDivisionId: handleDivisionChange,
    setSelectedDistrictId: handleDistrictChange,
    setSelectedUpazilaId: handleUpazilaChange,
    setSelectedUnion,
    setMouzaSearch,
    setSelectedMouzaIds,

    selectAllMouzas,
    selectAll100Percent: selectAllMouzas,
    deselectAll,
    invertSelection,
    toggleMouza,
    selectUnionOnly,
    addCustomMouza,
    importCustomMouzasJsonOrCsv,

    retryDiscovery,
  };
}
