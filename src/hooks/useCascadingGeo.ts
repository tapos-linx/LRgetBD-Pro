import { useCallback, useEffect, useMemo, useState } from 'react';
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
  setSelectedDivisionId: (divId: string | null) => void;
  setSelectedDistrictId: (distId: string | null) => void;
  setSelectedUpazilaId: (upzId: string | null) => void;
  setSelectedUnion: (union: string) => void;
  setMouzaSearch: (search: string) => void;
  setSelectedMouzaIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Fast Batch Controls
  selectAllMouzas: () => void;
  deselectAll: () => void;
  invertSelection: () => void;
  toggleMouza: (mouzaId: string) => void;
  selectUnionOnly: (unionName: string) => void;

  // Discovery Trigger
  retryDiscovery: () => void;
}

export function useCascadingGeo(): UseCascadingGeoReturn {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedUpazilaId, setSelectedUpazilaId] = useState<string | null>(null);
  const [selectedUnion, setSelectedUnion] = useState<string>('ALL');
  const [mouzaSearch, setMouzaSearch] = useState<string>('');
  
  const [districts, setDistricts] = useState<DistrictNode[]>([]);
  const [upazilas, setUpazilas] = useState<UpazilaNode[]>([]);
  const [mouzas, setMouzas] = useState<MouzaNode[]>([]);
  
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);

  const divisions = BANGLADESH_NATIONWIDE_HIERARCHY;

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

  // Combined Mouzas
  const allMouzasForUpazila = mouzas;

  // Available Unions
  const availableUnions = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMouzasForUpazila) {
      if (m.unionNameEn) set.add(m.unionNameEn);
    }
    return Array.from(set).sort();
  }, [allMouzasForUpazila]);

  // Filtered Mouzas
  const unionFilteredMouzas = useMemo(() => {
    if (selectedUnion === 'ALL') return allMouzasForUpazila;
    return allMouzasForUpazila.filter((m) => m.unionNameEn === selectedUnion);
  }, [allMouzasForUpazila, selectedUnion]);

  const [selectedMouzaIds, setSelectedMouzaIds] = useState<string[]>([]);

  // 1. Division Selection Handler (Phase 7)
  const handleDivisionChange = useCallback(async (divId: string | null) => {
    setSelectedDivisionId(divId);
    setSelectedDistrictId(null);
    setSelectedUpazilaId(null);
    setDistricts([]);
    setUpazilas([]);
    setMouzas([]);
    setSelectedMouzaIds([]);
    
    if (divId) {
      setIsDiscovering(true);
      setDiscoveryStatus('Fetching districts...');
      // Try DB first
      let cached = await geoDb.getDistricts(divId);
      if (cached.length === 0) {
        cached = await geoDiscovery.discoverDistricts(divId);
      }
      setDistricts(cached);
      setIsDiscovering(false);
      setDiscoveryStatus(cached.length > 0 ? null : 'No districts found for this division.');
    }
  }, []);

  // 2. District Selection Handler
  const handleDistrictChange = useCallback(async (distId: string | null) => {
    setSelectedDistrictId(distId);
    setSelectedUpazilaId(null);
    setUpazilas([]);
    setMouzas([]);
    setSelectedMouzaIds([]);
    
    if (distId) {
      setIsDiscovering(true);
      setDiscoveryStatus('Fetching upazilas...');
      let cached = await geoDb.getUpazilas(distId);
      if (cached.length === 0) {
        cached = await geoDiscovery.discoverUpazilas(distId);
      }
      setUpazilas(cached);
      setIsDiscovering(false);
      setDiscoveryStatus(cached.length > 0 ? null : 'No upazilas found for this district.');
    }
  }, []);

  // 3. Upazila Selection Handler (Phase 4 & 5)
  const handleUpazilaChange = useCallback(async (upzId: string | null) => {
    setSelectedUpazilaId(upzId);
    setMouzas([]);
    setSelectedMouzaIds([]);
    
    if (upzId) {
      setIsDiscovering(true);
      setDiscoveryStatus('Discovering actual Mouza records...');
      let cached = await geoDb.getMouzas(upzId);
      if (cached.length === 0) {
        cached = await geoDiscovery.discoverMouzas(upzId);
      }
      setMouzas(cached);
      
      // Automatic selection of ALL valid discovered Mouzas (Phase 4 Step 5)
      if (cached.length > 0) {
        setSelectedMouzaIds(cached.map(m => m.id));
        setDiscoveryStatus(null);
      } else {
        setDiscoveryStatus('No verified Mouza records found.');
      }
      setIsDiscovering(false);
    }
  }, []);

  const retryDiscovery = useCallback(() => {
    if (selectedUpazilaId) handleUpazilaChange(selectedUpazilaId);
    else if (selectedDistrictId) handleDistrictChange(selectedDistrictId);
    else if (selectedDivisionId) handleDivisionChange(selectedDivisionId);
  }, [selectedDivisionId, selectedDistrictId, selectedUpazilaId, handleDivisionChange, handleDistrictChange, handleUpazilaChange]);

  // Visible Mouzas
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
    unionFilteredMouzas.length > 0 &&
    unionFilteredMouzas.every((m) => selectedMouzaIds.includes(m.id));

  const selectAllMouzas = useCallback(() => {
    setSelectedMouzaIds(allMouzasForUpazila.map((m) => m.id));
  }, [allMouzasForUpazila]);

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
      setSelectedUnion(unionName);
      const matching = allMouzasForUpazila.filter(
        (m) => unionName === 'ALL' || m.unionNameEn === unionName
      );
      setSelectedMouzaIds(matching.map((m) => m.id));
    },
    [allMouzasForUpazila]
  );

  return {
    selectedDivisionId,
    selectedDistrictId,
    selectedUpazilaId,
    selectedUnion,
    mouzaSearch,
    selectedMouzaIds,

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
    deselectAll,
    invertSelection,
    toggleMouza,
    selectUnionOnly,
    
    retryDiscovery
  };
}
