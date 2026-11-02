import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  CheckSquare,
  Cloud,
  Download,
  ExternalLink,
  Filter,
  FolderArchive,
  Layers,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Square,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { initAuth } from './services/firebaseClient';
import {
  BookStyleConfig,
  EporchaEndpointType,
  KhatianRecord,
  MouzaNode,
  ProxyConfig,
  QueueTask,
  SurveyType,
} from './types/land';
import {
  ALL_ENDPOINT_TYPES,
  ALL_SURVEY_TYPES,
  ENDPOINT_MODE_META,
  generateTasksForMouzasAndEndpoints,
  GEO_HIERARCHY,
  SURVEY_LABELS,
} from './data/geoHierarchy';
import {
  checkEporchaPortalHealth,
  isCapacitorNativeRuntime,
} from './services/eporchaTechClient';
import {
  clearAllVerifiedPdfBlobs,
  clearExtractedKhatianRecords,
  getAllExtractedKhatianRecords,
  getAllVerifiedPdfBlobs,
  loadPersistedQueue,
  loadProxyConfig,
  saveExtractedKhatianRecords,
  savePersistedQueue,
  saveProxyConfig,
  batchUpdateVerifiedBlobFileNames,
} from './services/storageService';
import {
  buildQueueTasksForUpazila,
  buildUnifiedQueueForDocumentSelection,
  buildVerifiedArchiveZip,
  calculatePoliteJitterDelay,
  calculateQueueProgress,
  generateManifestAuditCsv,
  processSingleQueueTask,
  resetAllTasksToQueued,
  retryFailedTasks,
} from './services/queueEngine';
import {
  bundleTasksToStructuredZip,
  triggerIndividualPdfDownload,
  triggerZipDownload,
} from './services/downloadAndZipService';
import { ApkInstallerModal } from './components/ApkInstallerModal';
import { BatchRenameModal } from './components/BatchRenameModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { GlobalProgressBar } from './components/GlobalProgressBar';
import { NationwideQueueMonitor } from './components/NationwideQueueMonitor';
import { QueueConsoleView } from './components/QueueConsoleView';
import { TabularIndexView } from './components/TabularIndexView';
import { ArchitectureDocsView } from './components/ArchitectureDocsView';

type ActiveWorkspaceTab = 'extractor' | 'queue' | 'index' | 'docs';

export default function App() {
  // Navigation & Modal State
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('extractor');
  const [apkModalOpen, setApkModalOpen] = useState(false);
  const [batchRenameModalOpen, setBatchRenameModalOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [verifiedBlobTaskIds, setVerifiedBlobTaskIds] = useState<Set<string>>(
    () => new Set()
  );

  // Geographic Cascading State (Defaults to Chittagong -> Brahmanbaria -> Nabinagar)
  const [divisionId, setDivisionId] = useState<string>(GEO_HIERARCHY[0].id);
  const [districtId, setDistrictId] = useState<string>(
    GEO_HIERARCHY[0].districts[0].id
  );
  const [upazilaId, setUpazilaId] = useState<string>(
    GEO_HIERARCHY[0].districts[0].upazilas[0].id
  );
  const [customMouzasByUpazila, setCustomMouzasByUpazila] = useState<
    Record<string, MouzaNode[]>
  >({});

  // Union & Search Filter State
  const [unionFilter, setUnionFilter] = useState<string>('ALL');
  const [mouzaSearch, setMouzaSearch] = useState<string>('');

  // Selected Mouzas & IDs (100% auto-selected on Upazila change)
  const [selectedMouzas, setSelectedMouzas] = useState<MouzaNode[]>(() => [
    ...GEO_HIERARCHY[0].districts[0].upazilas[0].mouzas,
  ]);
  const [selectedMouzaIds, setSelectedMouzaIds] = useState<string[]>(() =>
    GEO_HIERARCHY[0].districts[0].upazilas[0].mouzas.map((m) => m.id)
  );

  // Custom Mouza Add Form State
  const [showCustomMouzaForm, setShowCustomMouzaForm] = useState(false);
  const [customJlNo, setCustomJlNo] = useState('');
  const [customNameBn, setCustomNameBn] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customUnionEn, setCustomUnionEn] = useState('20-No Kaitala South Union');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  // Multi-Select Document Types, Surveys & Book Format State
  const [selectedEndpoints, setSelectedEndpoints] = useState<
    EporchaEndpointType[]
  >(['mouza-vittik-khatian']);
  const [selectedSurveys, setSelectedSurveys] = useState<SurveyType[]>([
    'RS',
    'BS',
  ]);
  const [bookStyle, setBookStyle] = useState<BookStyleConfig>({
    layout: 'new',
    colorMode: 'color',
  });
  const [khatianInput, setKhatianInput] = useState<string>('ALL');
  const [mapSheetInput, setMapSheetInput] = useState<number>(1);
  const [enqueueFeedback, setEnqueueFeedback] = useState<string | null>(null);

  // Queue, Proxy & Storage State
  const [tasks, setTasks] = useState<QueueTask[]>(() => {
    const persisted = loadPersistedQueue();
    if (persisted.length > 0) return persisted;
    const initDiv = GEO_HIERARCHY[0];
    const initDist = initDiv.districts[0];
    const initUpz = initDist.upazilas[0];
    return buildQueueTasksForUpazila({
      division: initDiv,
      district: initDist,
      upazila: initUpz,
      endpoints: ['mouza-vittik-khatian'],
      surveys: ['RS', 'BS'],
      bookStyle: { layout: 'new', colorMode: 'color' },
      khatianNo: 'ALL',
      mapSheetNo: 1,
    }).tasks;
  });

  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>(() =>
    loadProxyConfig()
  );
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isBundlingZip, setIsBundlingZip] = useState(false);
  const [lastBundleStatus, setLastBundleStatus] = useState<string | null>(null);
  const [tabularRecords, setTabularRecords] = useState<KhatianRecord[]>([]);

  // Portal Connectivity State
  const [portalHealth, setPortalHealth] = useState<{
    reachable: boolean;
    status: number;
    latencyMs: number;
    checked: boolean;
  }>({ reachable: true, status: 200, latencyMs: 0, checked: false });

  // Active Division / District / Upazila Nodes
  const activeDivision = useMemo(
    () =>
      GEO_HIERARCHY.find((d) => d.id === divisionId) || GEO_HIERARCHY[0],
    [divisionId]
  );

  const activeDistrict = useMemo(
    () =>
      activeDivision.districts.find((d) => d.id === districtId) ||
      activeDivision.districts[0],
    [activeDivision, districtId]
  );

  const activeUpazila = useMemo(
    () =>
      activeDistrict.upazilas.find((u) => u.id === upazilaId) ||
      activeDistrict.upazilas[0],
    [activeDistrict, upazilaId]
  );

  const allMouzasForUpazila = useMemo(() => {
    const customList = customMouzasByUpazila[activeUpazila.id] || [];
    return [...activeUpazila.mouzas, ...customList];
  }, [activeUpazila, customMouzasByUpazila]);

  // Distinct Unions for quick filter
  const availableUnions = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMouzasForUpazila) {
      set.add(m.unionNameEn);
    }
    return Array.from(set);
  }, [allMouzasForUpazila]);

  // Visible Mouzas after Union & Search filtering
  const visibleMouzas = useMemo(() => {
    return allMouzasForUpazila.filter((m) => {
      if (unionFilter !== 'ALL' && m.unionNameEn !== unionFilter) {
        return false;
      }
      if (!mouzaSearch.trim()) return true;
      const q = mouzaSearch.toLowerCase();
      return (
        m.jlNo.toLowerCase().includes(q) ||
        m.nameEn.toLowerCase().includes(q) ||
        m.nameBn.includes(mouzaSearch) ||
        m.unionNameEn.toLowerCase().includes(q) ||
        m.unionNameBn.includes(mouzaSearch)
      );
    });
  }, [allMouzasForUpazila, unionFilter, mouzaSearch]);

  // Helper to rebuild the download queue for a given set of Mouzas, Endpoints & Surveys
  const syncQueueWithSelection = useCallback(
    (params: {
      div: typeof activeDivision;
      dist: typeof activeDistrict;
      upz: typeof activeUpazila;
      mouzas: MouzaNode[];
      endpoints: EporchaEndpointType[];
      surveys: SurveyType[];
      autoStart?: boolean;
      feedbackMessage?: string;
    }) => {
      const builtTasks = generateTasksForMouzasAndEndpoints({
        divisionNameEn: params.div.nameEn,
        divisionSlug: params.div.eporchaSlug,
        districtNameEn: params.dist.nameEn,
        districtNameBn: params.dist.nameBn,
        districtSlug: params.dist.eporchaSlug,
        upazilaNameEn: params.upz.nameEn,
        upazilaNameBn: params.upz.nameBn,
        upazilaSlug: params.upz.eporchaSlug,
        mouzas: params.mouzas,
        endpoints: params.endpoints,
        surveys: params.surveys,
        bookStyle,
        khatianNo: khatianInput.trim() || 'ALL',
        mapSheetNo: mapSheetInput || 1,
      });

      setSelectedMouzas(params.mouzas);
      setSelectedMouzaIds(params.mouzas.map((m) => m.id));
      setActiveTaskId(null);
      setTasks(builtTasks);
      savePersistedQueue(builtTasks);
      if (params.feedbackMessage) {
        setEnqueueFeedback(params.feedbackMessage);
      }
      if (params.autoStart) {
        setIsQueueRunning(true);
      }
    },
    [bookStyle, khatianInput, mapSheetInput]
  );

  // 1. Cascade Handler: Division Change -> Updates District -> Updates Upazilas -> Auto-Selects 100% Mouzas & Triggers Queue Generation Engine
  const handleDivisionChange = (nextDivisionId: string) => {
    setDivisionId(nextDivisionId);
    const nextDiv =
      GEO_HIERARCHY.find((d) => d.id === nextDivisionId) || GEO_HIERARCHY[0];
    const firstDist = nextDiv.districts[0];
    const firstUpz = firstDist.upazilas[0];
    setDistrictId(firstDist.id);
    setUpazilaId(firstUpz.id);
    setUnionFilter('ALL');
    setMouzaSearch('');

    const { allMouzas, selectedMouzaIds: nextSelectedIds, tasks: builtTasks } =
      buildQueueTasksForUpazila({
        division: nextDiv,
        district: firstDist,
        upazila: firstUpz,
        customMouzas: customMouzasByUpazila[firstUpz.id] || [],
        endpoints: selectedEndpoints,
        surveys: selectedSurveys,
        bookStyle,
        khatianNo: khatianInput.trim() || 'ALL',
        mapSheetNo: mapSheetInput || 1,
      });

    setSelectedMouzas(allMouzas);
    setSelectedMouzaIds(nextSelectedIds);
    setActiveTaskId(null);
    setTasks(builtTasks);
    savePersistedQueue(builtTasks);
    setIsQueueRunning(true);
    setEnqueueFeedback(
      `Division "${nextDiv.nameEn}" → District "${firstDist.nameEn}" → Upazila "${firstUpz.nameEn}": Total Mouzas Found: ${allMouzas.length} (100% auto-selected). Queue auto-started from Index 0 (${builtTasks.length} tasks).`
    );
  };

  // 2. Cascade Handler: District Change -> Automatically populates all Upazilas for that District & selects 100% Mouzas of first Upazila
  const handleDistrictChange = (nextDistrictId: string) => {
    setDistrictId(nextDistrictId);
    const nextDist =
      activeDivision.districts.find((d) => d.id === nextDistrictId) ||
      activeDivision.districts[0];
    const firstUpz = nextDist.upazilas[0];
    setUpazilaId(firstUpz.id);
    setUnionFilter('ALL');
    setMouzaSearch('');

    const { allMouzas, selectedMouzaIds: nextSelectedIds, tasks: builtTasks } =
      buildQueueTasksForUpazila({
        division: activeDivision,
        district: nextDist,
        upazila: firstUpz,
        customMouzas: customMouzasByUpazila[firstUpz.id] || [],
        endpoints: selectedEndpoints,
        surveys: selectedSurveys,
        bookStyle,
        khatianNo: khatianInput.trim() || 'ALL',
        mapSheetNo: mapSheetInput || 1,
      });

    setSelectedMouzas(allMouzas);
    setSelectedMouzaIds(nextSelectedIds);
    setActiveTaskId(null);
    setTasks(builtTasks);
    savePersistedQueue(builtTasks);
    setIsQueueRunning(true);
    setEnqueueFeedback(
      `District "${nextDist.nameBn} (${nextDist.nameEn})" selected: Loaded all ${nextDist.upazilas.length} Upazilas. Total Mouzas Found in ${firstUpz.nameEn}: ${allMouzas.length} (100% auto-selected). Queue auto-started from Index 0 (${builtTasks.length} tasks).`
    );
  };

  // 3. Cascade Handler: Upazila Change -> Immediately fetches/counts all Mouzas, auto-selects 100% without manual clicks, builds queue array, and automatically starts sequential execution from Queue Index 0!
  const handleUpazilaChange = (nextUpazilaId: string) => {
    setActiveTaskId(null);
    setUnionFilter('ALL');
    setMouzaSearch('');
    setUpazilaId(nextUpazilaId);

    const nextUpz =
      activeDistrict.upazilas.find((u) => u.id === nextUpazilaId) ||
      activeDistrict.upazilas[0];

    // Force-select 100% of the new Upazila's Mouzas and build queue
    const { allMouzas, selectedMouzaIds: nextSelectedIds, tasks: builtTasks } =
      buildQueueTasksForUpazila({
        division: activeDivision,
        district: activeDistrict,
        upazila: nextUpz,
        customMouzas: customMouzasByUpazila[nextUpz.id] || [],
        endpoints: selectedEndpoints,
        surveys: selectedSurveys,
        bookStyle,
        khatianNo: khatianInput.trim() || 'ALL',
        mapSheetNo: mapSheetInput || 1,
      });

    setSelectedMouzas(allMouzas);
    setSelectedMouzaIds(nextSelectedIds);
    setTasks(builtTasks);
    savePersistedQueue(builtTasks);
    // Begin execution automatically, starting from Queue Index 0 (1st Mouza)
    setIsQueueRunning(true);

    setEnqueueFeedback(
      `Upazila "${nextUpz.nameBn} (${nextUpz.nameEn})" selected: Total Mouzas Found: ${allMouzas.length}. 100% Mouzas auto-selected. Processing queue generated with ${builtTasks.length} tasks and started automatically from Index 0.`
    );
  };

  // Restart queue from Queue Index 0 (1st Mouza)
  const handleRestartQueueFromZero = () => {
    setActiveTaskId(null);
    const resetTasks: QueueTask[] = tasks.map((t) => ({
      ...t,
      status: 'QUEUED' as const,
      pdfVerified: false,
      retries: 0,
      errorMessage: undefined,
    }));
    setTasks(resetTasks);
    savePersistedQueue(resetTasks);
    setIsQueueRunning(true);
    setEnqueueFeedback(
      `Queue reset to Index 0: Sequential processing restarted for all ${allMouzasForUpazila.length} Mouzas.`
    );
  };

  // 4. Document Type Selection Menu: "Select All" Handler -> Force clears previous selections, sets selectedMouzaIds to the full list for the active Upazila, and automatically initiates the download sequence for all 5 document modes and all survey types without additional user interaction!
  const handleSelectAllDocumentTypesAndFetch = () => {
    // 1. Force clear any previous partial/union filters or running task locks
    setUnionFilter('ALL');
    setMouzaSearch('');
    setActiveTaskId(null);

    const allEndpoints: EporchaEndpointType[] = [...ALL_ENDPOINT_TYPES];
    const allSurveys: SurveyType[] = [...ALL_SURVEY_TYPES];
    const fullUpazilaMouzaIds = allMouzasForUpazila.map((m) => m.id);

    // 2. Build the complete unified queue for 100% of Mouzas in the active Upazila across all 5 document modes & all 5 survey types
    const {
      selectedMouzaIds: nextSelectedMouzaIds,
      selectedMouzas: nextSelectedMouzas,
      tasks: builtTasks,
    } = buildUnifiedQueueForDocumentSelection({
      division: activeDivision,
      district: activeDistrict,
      upazila: activeUpazila,
      allMouzasForUpazila,
      currentSelectedMouzaIds: fullUpazilaMouzaIds,
      endpoints: allEndpoints,
      surveys: allSurveys,
      bookStyle,
      khatianNo: khatianInput.trim() || 'ALL',
      mapSheetNo: mapSheetInput || 1,
    });

    // 3. Apply full selection state and immediately initiate the download sequence
    setSelectedMouzas(nextSelectedMouzas);
    setSelectedMouzaIds(nextSelectedMouzaIds);
    setSelectedEndpoints(allEndpoints);
    setSelectedSurveys(allSurveys);
    setTasks(builtTasks);
    savePersistedQueue(builtTasks);
    setIsQueueRunning(true);
    setEnqueueFeedback(
      `Cleared previous partial filters and selected 100% Mouzas (${nextSelectedMouzas.length}/${allMouzasForUpazila.length}) in ${activeUpazila.nameEn} with ALL 5 Document Modes & ALL 5 Survey Types — ${builtTasks.length} tasks queued and downloading automatically from https://eporcha.tech!`
    );
  };

  // Toggle an individual Document Type Card -> Immediately triggers unified download task build
  const handleToggleEndpointType = (modeKey: EporchaEndpointType) => {
    const nextEndpoints = selectedEndpoints.includes(modeKey)
      ? selectedEndpoints.length > 1
        ? selectedEndpoints.filter((k) => k !== modeKey)
        : selectedEndpoints
      : [...selectedEndpoints, modeKey];

    const {
      selectedMouzaIds: nextSelectedMouzaIds,
      selectedMouzas: nextSelectedMouzas,
      tasks: builtTasks,
    } = buildUnifiedQueueForDocumentSelection({
      division: activeDivision,
      district: activeDistrict,
      upazila: activeUpazila,
      allMouzasForUpazila,
      currentSelectedMouzaIds: selectedMouzaIds,
      endpoints: nextEndpoints,
      surveys: selectedSurveys,
      bookStyle,
      khatianNo: khatianInput.trim() || 'ALL',
      mapSheetNo: mapSheetInput || 1,
    });

    setSelectedEndpoints(nextEndpoints);
    setSelectedMouzas(nextSelectedMouzas);
    setSelectedMouzaIds(nextSelectedMouzaIds);
    setActiveTaskId(null);
    setTasks(builtTasks);
    savePersistedQueue(builtTasks);
    setEnqueueFeedback(
      `Updated Document Modes (${nextEndpoints.length}/${ALL_ENDPOINT_TYPES.length}) across ${nextSelectedMouzas.length} Mouzas in ${activeUpazila.nameEn} — ${builtTasks.length} tasks ready in queue.`
    );
  };

  // Load IndexedDB records, blobs & check portal health on mount
  useEffect(() => {
    getAllExtractedKhatianRecords().then(setTabularRecords);
    getAllVerifiedPdfBlobs().then((blobs) => {
      setVerifiedBlobTaskIds(new Set(blobs.map((b) => b.taskId)));
    });
    checkEporchaPortalHealth().then((res) => {
      setPortalHealth({
        reachable: res.reachable,
        status: res.status,
        latencyMs: res.latencyMs,
        checked: true,
      });
    });
  }, []);

  // Persist Queue & refresh verified blob IDs whenever tasks change
  useEffect(() => {
    savePersistedQueue(tasks);
    getAllVerifiedPdfBlobs().then((blobs) => {
      setVerifiedBlobTaskIds(new Set(blobs.map((b) => b.taskId)));
    });
  }, [tasks]);

  // Update Proxy Config
  const handleUpdateProxyConfig = (next: ProxyConfig) => {
    setProxyConfig(next);
    saveProxyConfig(next);
  };

  // Toggle a single Mouza checkbox and update queue
  const toggleMouzaSelection = (mouzaId: string) => {
    const nextIds = selectedMouzaIds.includes(mouzaId)
      ? selectedMouzaIds.filter((id) => id !== mouzaId)
      : [...selectedMouzaIds, mouzaId];
    setSelectedMouzaIds(nextIds);

    const chosenMouzas = allMouzasForUpazila.filter((m) =>
      nextIds.includes(m.id)
    );
    syncQueueWithSelection({
      div: activeDivision,
      dist: activeDistrict,
      upz: activeUpazila,
      mouzas: chosenMouzas,
      endpoints: selectedEndpoints,
      surveys: selectedSurveys,
    });
  };

  // Whether 100% of available Mouzas for the active Upazila are currently selected
  const areAllMouzasSelected =
    allMouzasForUpazila.length > 0 &&
    allMouzasForUpazila.every((m) => selectedMouzaIds.includes(m.id));

  // Select 100% of Mouzas in current Upazila and rebuild queue
  const selectAll100PercentMouzas = () => {
    setUnionFilter('ALL');
    setMouzaSearch('');
    const allIds = allMouzasForUpazila.map((m) => m.id);
    setSelectedMouzaIds(allIds);
    syncQueueWithSelection({
      div: activeDivision,
      dist: activeDistrict,
      upz: activeUpazila,
      mouzas: allMouzasForUpazila,
      endpoints: selectedEndpoints,
      surveys: selectedSurveys,
      feedbackMessage: `Selected all ${allMouzasForUpazila.length} Mouzas (100%) in ${activeUpazila.nameEn} and updated download queue.`,
    });
  };

  // Toggle Switch Handler: Select / Deselect All Mouzas for the current Upazila
  const handleToggleSelectDeselectAllMouzas = () => {
    if (areAllMouzasSelected) {
      setIsQueueRunning(false);
      setActiveTaskId(null);
      setSelectedMouzas([]);
      setSelectedMouzaIds([]);
      setTasks([]);
      savePersistedQueue([]);
      setEnqueueFeedback(
        `Deselected all Mouzas in ${activeUpazila.nameEn} (0/${allMouzasForUpazila.length}). Select specific Mouzas manually or toggle 'Select/Deselect All' back ON.`
      );
    } else {
      selectAll100PercentMouzas();
    }
  };

  // Select only visible Mouzas (e.g. 20-No Kaitala South Union)
  const selectOnlyVisibleUnionMouzas = (targetUnion: string) => {
    setUnionFilter(targetUnion);
    const matchingMouzas = allMouzasForUpazila.filter(
      (m) => targetUnion === 'ALL' || m.unionNameEn === targetUnion
    );
    setSelectedMouzas(matchingMouzas);
    setSelectedMouzaIds(matchingMouzas.map((m) => m.id));
    syncQueueWithSelection({
      div: activeDivision,
      dist: activeDistrict,
      upz: activeUpazila,
      mouzas: matchingMouzas,
      endpoints: selectedEndpoints,
      surveys: selectedSurveys,
      feedbackMessage: `Filtered to ${matchingMouzas.length} Mouzas (${targetUnion}) and updated download queue.`,
    });
  };

  // Toggle Survey Type -> Immediately triggers unified download task build
  const toggleSurveyType = (srv: SurveyType) => {
    const nextSurveys = selectedSurveys.includes(srv)
      ? selectedSurveys.length > 1
        ? selectedSurveys.filter((s) => s !== srv)
        : selectedSurveys
      : [...selectedSurveys, srv];

    const {
      selectedMouzaIds: nextSelectedMouzaIds,
      selectedMouzas: nextSelectedMouzas,
      tasks: builtTasks,
    } = buildUnifiedQueueForDocumentSelection({
      division: activeDivision,
      district: activeDistrict,
      upazila: activeUpazila,
      allMouzasForUpazila,
      currentSelectedMouzaIds: selectedMouzaIds,
      endpoints: selectedEndpoints,
      surveys: nextSurveys,
      bookStyle,
      khatianNo: khatianInput.trim() || 'ALL',
      mapSheetNo: mapSheetInput || 1,
    });

    setSelectedSurveys(nextSurveys);
    setSelectedMouzas(nextSelectedMouzas);
    setSelectedMouzaIds(nextSelectedMouzaIds);
    setActiveTaskId(null);
    setTasks(builtTasks);
    savePersistedQueue(builtTasks);
    setEnqueueFeedback(
      `Updated Survey Types (${nextSurveys.join(', ')}) across ${nextSelectedMouzas.length} Mouzas in ${activeUpazila.nameEn} — ${builtTasks.length} tasks ready in queue.`
    );
  };

  // Add Dynamic Custom Mouza
  const handleAddCustomMouza = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customJlNo.trim() || !customNameEn.trim()) {
      setCustomFormError('Both JL Number and Mouza English Name are required.');
      return;
    }
    setCustomFormError(null);
    const newMouza: MouzaNode = {
      id: `mz-custom-${activeUpazila.id}-${Date.now()}`,
      jlNo: customJlNo.trim(),
      nameEn: customNameEn.trim(),
      nameBn: customNameBn.trim() || customNameEn.trim(),
      unionNameEn: customUnionEn.trim() || 'Custom Union',
      unionNameBn: customUnionEn.trim() || 'কাস্টম ইউনিয়ন',
      availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'],
      estimatedKhatians: 500,
      estimatedDags: 1200,
      mapSheets: [1],
    };

    const nextCustomList = [
      ...(customMouzasByUpazila[activeUpazila.id] || []),
      newMouza,
    ];
    setCustomMouzasByUpazila((prev) => ({
      ...prev,
      [activeUpazila.id]: nextCustomList,
    }));

    const nextIds = [...selectedMouzaIds, newMouza.id];
    setSelectedMouzaIds(nextIds);
    const updatedAll = [...activeUpazila.mouzas, ...nextCustomList];
    syncQueueWithSelection({
      div: activeDivision,
      dist: activeDistrict,
      upz: activeUpazila,
      mouzas: updatedAll.filter((m) => nextIds.includes(m.id)),
      endpoints: selectedEndpoints,
      surveys: selectedSurveys,
    });

    setCustomJlNo('');
    setCustomNameBn('');
    setCustomNameEn('');
    setShowCustomMouzaForm(false);
  };

  // Enqueue Selected Mouzas x Endpoints x Surveys into Polite Queue
  const handleEnqueueBatch = (autoStartAfterEnqueue: boolean) => {
    const chosenMouzas = allMouzasForUpazila.filter((m) =>
      selectedMouzaIds.includes(m.id)
    );
    if (chosenMouzas.length === 0) {
      setEnqueueFeedback('Select at least 1 Mouza before enqueuing tasks.');
      return;
    }

    const builtTasks = generateTasksForMouzasAndEndpoints({
      divisionNameEn: activeDivision.nameEn,
      divisionSlug: activeDivision.eporchaSlug,
      districtNameEn: activeDistrict.nameEn,
      districtNameBn: activeDistrict.nameBn,
      districtSlug: activeDistrict.eporchaSlug,
      upazilaNameEn: activeUpazila.nameEn,
      upazilaNameBn: activeUpazila.nameBn,
      upazilaSlug: activeUpazila.eporchaSlug,
      mouzas: chosenMouzas,
      endpoints: selectedEndpoints,
      surveys: selectedSurveys,
      bookStyle,
      khatianNo: khatianInput.trim() || 'ALL',
      mapSheetNo: mapSheetInput || 1,
    });

    setTasks(builtTasks);
    setEnqueueFeedback(
      `Prepared ${builtTasks.length} download queue tasks (${chosenMouzas.length} Mouzas × ${selectedEndpoints.length} Document Modes × ${selectedSurveys.length} Surveys) from https://eporcha.tech.`
    );

    if (autoStartAfterEnqueue) {
      setIsQueueRunning(true);
    }
  };

  // Run a single task immediately
  const handleRunSingleTask = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      setActiveTaskId(taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: 'FETCHING_EPORCHA_TECH' } : t
        )
      );

      const { updatedTask, extractedCount } = await processSingleQueueTask(
        target,
        proxyConfig
      );

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? updatedTask : t))
      );

      if (extractedCount > 0) {
        const refreshed = await getAllExtractedKhatianRecords();
        setTabularRecords(refreshed);
      }
      setActiveTaskId(null);
    },
    [tasks, proxyConfig]
  );

  // Sequential Queue Loop with 600ms-1200ms Polite Delay Jitter
  const queueStepCounterRef = useRef(0);
  useEffect(() => {
    if (!isQueueRunning) return;
    if (activeTaskId !== null) return;

    const nextQueued = tasks.find((t) => t.status === 'QUEUED');
    if (!nextQueued) {
      setIsQueueRunning(false);
      return;
    }

    const jitterMs = calculatePoliteJitterDelay(
      proxyConfig.minDelayMs,
      proxyConfig.maxDelayMs,
      queueStepCounterRef.current++
    );

    const timer = setTimeout(() => {
      handleRunSingleTask(nextQueued.id);
    }, jitterMs);

    return () => clearTimeout(timer);
  }, [isQueueRunning, activeTaskId, tasks, proxyConfig, handleRunSingleTask]);

  const handleRetryFailed = () => {
    const { updatedTasks, retriedCount } = retryFailedTasks(tasks);
    setTasks(updatedTasks);
    savePersistedQueue(updatedTasks);
    setEnqueueFeedback(
      retriedCount > 0
        ? `Reset ${retriedCount} non-PDF / CORS-blocked tasks back to QUEUED.`
        : 'No failed or blocked tasks found in queue to retry.'
    );
  };

  const handleDownloadIndividualTask = async (task: QueueTask) => {
    const success = await triggerIndividualPdfDownload(task);
    if (success) {
      setEnqueueFeedback(`Downloaded individual record: ${task.fileName}`);
    } else {
      setEnqueueFeedback(
        `Binary for ${task.fileName} is not in cache yet. Click "Fetch Now" to download directly.`
      );
    }
  };

  const handleApplyBatchRename = async (renameMap: Map<string, string>) => {
    const { updatedCount } = await batchUpdateVerifiedBlobFileNames(renameMap);
    const updatedTasks = tasks.map((t) => {
      if (renameMap.has(t.id)) {
        return {
          ...t,
          fileName: renameMap.get(t.id)!,
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });
    setTasks(updatedTasks);
    savePersistedQueue(updatedTasks);
    setEnqueueFeedback(
      `Batch renamed ${renameMap.size} records (${updatedCount} updated in 'lr_verified_blobs' IndexedDB store).`
    );
    const refreshedBlobs = await getAllVerifiedPdfBlobs();
    setVerifiedBlobTaskIds(new Set(refreshedBlobs.map((b) => b.taskId)));
  };

  const handleClearQueue = async () => {
    setIsQueueRunning(false);
    setTasks([]);
    await clearAllVerifiedPdfBlobs();
    setLastBundleStatus(null);
  };

  const handleExportAuditCsv = () => {
    const csv = generateManifestAuditCsv(tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MANIFEST_AUDIT_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBundleZip = async () => {
    if (tasks.length === 0) return;
    setIsBundlingZip(true);
    setLastBundleStatus('Preparing structured ZIP archive with forensic manifest...');
    try {
      const { zipBlob, verifiedPdfCount, zipFileName } =
        await bundleTasksToStructuredZip({
          tasks,
          onProgress: (percent, statusText) => {
            setLastBundleStatus(`${percent}%: ${statusText}`);
          },
        });
      triggerZipDownload(zipBlob, zipFileName);
      setLastBundleStatus(
        `Successfully downloaded ${zipFileName} (${(zipBlob.size / 1024).toFixed(1)} KB) containing ${verifiedPdfCount} verified PDFs in [District]/[Upazila]/[Survey] directory structure + MANIFEST_AUDIT.csv & MANIFEST_AUDIT.md.`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setLastBundleStatus(`ZIP packaging error: ${msg}`);
    } finally {
      setIsBundlingZip(false);
    }
  };

  const handleImportRecords = async (newRecords: KhatianRecord[]) => {
    await saveExtractedKhatianRecords(newRecords);
    const updated = await getAllExtractedKhatianRecords();
    setTabularRecords(updated);
  };

  const handleClearRecords = async () => {
    await clearExtractedKhatianRecords();
    setTabularRecords([]);
  };

  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setCurrentUser(user);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const queueMetrics = useMemo(() => calculateQueueProgress(tasks), [tasks]);
  const queuedCount = queueMetrics.queuedCount;
  const completedOrExtractedCount = queueMetrics.completedCount;
  const verifiedPdfCount = queueMetrics.verifiedPdfCount;
  const nativeCapActive = isCapacitorNativeRuntime();
  const allDocsSelected =
    selectedEndpoints.length === ALL_ENDPOINT_TYPES.length &&
    selectedSurveys.length === ALL_SURVEY_TYPES.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Sticky Header & Global Queue Progress Bar Container */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
        {/* Top Bar Contract: Strictly 3 Zones */}
        <header className="px-3 sm:px-8 py-3 flex items-center justify-between gap-2 sm:gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('extractor');
            }}
            className="text-sm sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            LRgetBD v2.1 · LandArchive BD
          </a>

          {/* Zone 2: 4 concise single-line navigation links with subtle transition effect */}
          <nav
            aria-label="Primary Workspace Navigation"
            className="hidden md:flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-800/80 backdrop-blur-sm"
          >
            {[
              { id: 'extractor', label: 'Extractor' },
              { id: 'queue', label: `Live Queue (${tasks.length})` },
              { id: 'index', label: `Tabular Index (${tabularRecords.length})` },
              { id: 'docs', label: '6-Doc Architecture' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ActiveWorkspaceTab)}
                  className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ease-out whitespace-nowrap shrink-0 flex items-center gap-2 select-none ${
                    isActive
                      ? 'text-white bg-slate-800/95 border border-slate-700/80 shadow-sm shadow-emerald-950/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <span className="relative z-10">{tab.label}</span>
                  {isActive && (
                    <span
                      className="absolute inset-x-3 -bottom-[1px] h-[2px] bg-emerald-400 rounded-full transition-all duration-200 ease-out shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setDriveModalOpen(true)}
              className="px-2.5 py-2 sm:px-3 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Google Drive & Cloud</span>
              <span className="sm:hidden">Drive</span>
              {currentUser && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setApkModalOpen(true)}
              className="px-3 py-2 sm:px-4 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline">Download</span>
              <span>APK</span>
            </button>
          </div>
        </header>

        {/* Global Task Completion Progress Bar Strip */}
        <GlobalProgressBar
          metrics={queueMetrics}
          isQueueRunning={isQueueRunning}
          activeTab={activeTab}
          onViewQueue={() => setActiveTab('queue')}
          onToggleQueue={() => setIsQueueRunning((prev) => !prev)}
        />
      </div>

      {/* Mobile Navigation Bar (Visible on mobile/tablet) with subtle transitions */}
      <div className="md:hidden flex items-center justify-around border-b border-slate-800 bg-slate-900 px-2 py-1.5 gap-1">
        {[
          { id: 'extractor', label: 'Extractor' },
          { id: 'queue', label: `Queue (${tasks.length})` },
          { id: 'index', label: `Index (${tabularRecords.length})` },
          { id: 'docs', label: '6-Docs' },
        ].map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as ActiveWorkspaceTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-200 ease-out ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Main Workspace Container (1440px Desktop Presence) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Contextual Workspace Header & Telemetry Strip (Unboxed zero-pill metadata) */}
        <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
              <span className="text-emerald-400 font-semibold">
                Target Portal: https://eporcha.tech
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Transport:{' '}
                {nativeCapActive
                  ? 'Native Capacitor HTTP (CORS-Free)'
                  : proxyConfig.preferredMode}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Portal Status:{' '}
                {portalHealth.checked
                  ? portalHealth.reachable
                    ? `HTTP ${portalHealth.status} (${portalHealth.latencyMs}ms)`
                    : 'Relay Active'
                  : 'Checking...'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-bn">
              বাংলাদেশ ভূমি রেকর্ড বাল্ক ডাউনলোডার ও খতিয়ান/দাগ বই আর্কাইভার (eporcha.tech Open-Access Edition)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular text-slate-300 shrink-0">
            <div>
              <span className="text-slate-400">Upazila Total Mouzas: </span>
              <span className="text-emerald-400 font-bold">
                {allMouzasForUpazila.length}
              </span>
            </div>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <div>
              <span className="text-slate-400">Selected Mouzas: </span>
              <span className="text-white font-semibold">
                {selectedMouzaIds.length}/{allMouzasForUpazila.length}
              </span>
            </div>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <div>
              <span className="text-slate-400">Download Queue: </span>
              <span className="text-amber-400 font-semibold">
                {tasks.length} Tasks ({completedOrExtractedCount} Fetched)
              </span>
            </div>
          </div>
        </section>

        {/* WORKSPACE VIEW 1: EXTRACTOR */}
        {activeTab === 'extractor' && (
          <div key="view-extractor" className="space-y-6 workspace-view-enter">
            {/* STEP 01: Cascading Area Selection (Division -> District -> Upazila -> Auto-Select 100% Mouzas) */}
            <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      01. Cascading Area Selection (বিভাগ → জেলা → উপজেলা → ১০০% মৌজা অটো-সিলেকশন)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 font-bn mt-0.5">
                    জেলা পরিবর্তন করলে সাথে সাথে সব উপজেলা লোড হয় এবং নতুন উপজেলা নির্বাচন করলে সব মৌজা (১০০%) স্বয়ংক্রিয়ভাবে সিলেক্ট হয়ে ডাউনলোড কিউ প্রস্তুত করে।
                  </p>
                </div>

                {/* Prominent Upazila Total Mouza Counter & Quick Toggles */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border-2 border-emerald-500/60 text-xs font-mono-tabular text-slate-200 shadow-md">
                    <span className="text-slate-300 font-medium">Total Mouzas Found:</span>{' '}
                    <span className="text-emerald-400 font-black text-sm">
                      {allMouzasForUpazila.length}
                    </span>{' '}
                    <span className="text-emerald-300 font-bold ml-1">
                      (100% Auto-Selected: {selectedMouzaIds.length}/{allMouzasForUpazila.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={selectAll100PercentMouzas}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/60 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                  >
                    Select All Mouzas ({allMouzasForUpazila.length})
                  </button>

                  {activeUpazila.id === 'upz-nabinagar' && (
                    <button
                      type="button"
                      onClick={() =>
                        selectOnlyVisibleUnionMouzas('20-No Kaitala South Union')
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/60 hover:bg-amber-500/30 text-amber-200 text-xs font-medium font-bn transition-colors whitespace-nowrap shrink-0"
                    >
                      ২০নং কাইতলা দক্ষিণ ইউনিয়ন (Goalai · Kaitala)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMouzaIds([]);
                      setTasks([]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                  >
                    Clear Mouzas
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCustomMouzaForm(!showCustomMouzaForm)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Add Custom Mouza JL</span>
                  </button>
                </div>
              </div>

              {/* Cascading Area Dropdown Menus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label
                    htmlFor="division-select"
                    className="block text-xs text-slate-400 mb-1 font-bn"
                  >
                    ১. বিভাগ (Division — {GEO_HIERARCHY.length} Available)
                  </label>
                  <select
                    id="division-select"
                    value={divisionId}
                    onChange={(e) => handleDivisionChange(e.target.value)}
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
                    htmlFor="district-select"
                    className="block text-xs text-slate-400 mb-1 font-bn"
                  >
                    ২. জেলা নির্বাচন করুন (District — {activeDivision.districts.length} Available)
                  </label>
                  <select
                    id="district-select"
                    value={districtId}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-bn focus:outline-none focus:border-emerald-500"
                  >
                    {activeDivision.districts.map((dist) => (
                      <option key={dist.id} value={dist.id}>
                        {dist.nameBn} ({dist.nameEn}) — {dist.upazilas.length} Upazilas
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="upazila-select"
                    className="block text-xs text-emerald-400 font-semibold mb-1 font-bn"
                  >
                    ৩. উপজেলা (Upazila in {activeDistrict.nameEn} — {activeDistrict.upazilas.length} Upazilas)
                  </label>
                  <select
                    id="upazila-select"
                    value={upazilaId}
                    onChange={(e) => handleUpazilaChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-emerald-500/70 text-xs text-white font-bn focus:outline-none focus:border-emerald-400"
                  >
                    {activeDistrict.upazilas.map((upz) => {
                      const customCount = (customMouzasByUpazila[upz.id] || [])
                        .length;
                      const totalM = upz.mouzas.length + customCount;
                      return (
                        <option key={upz.id} value={upz.id}>
                          {upz.nameBn} ({upz.nameEn}) — Total {totalM} Mouzas
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="union-filter-select"
                    className="block text-xs text-slate-400 mb-1 font-bn"
                  >
                    ৪. ইউনিয়ন ফিল্টার (Union Filter)
                  </label>
                  <div className="relative flex items-center">
                    <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                    <select
                      id="union-filter-select"
                      value={unionFilter}
                      onChange={(e) =>
                        selectOnlyVisibleUnionMouzas(e.target.value)
                      }
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ALL">
                        All Unions ({allMouzasForUpazila.length} Mouzas Selected)
                      </option>
                      {availableUnions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Nationwide Automated Queue Monitor & Prominent Mouza Counter */}
              <NationwideQueueMonitor
                upazila={activeUpazila}
                districtNameEn={activeDistrict.nameEn}
                divisionNameEn={activeDivision.nameEn}
                totalMouzasCount={allMouzasForUpazila.length}
                selectedMouzas={allMouzasForUpazila}
                tasks={tasks}
                isQueueRunning={isQueueRunning}
                activeTaskId={activeTaskId}
                onToggleQueue={() => setIsQueueRunning((prev) => !prev)}
                onRestartQueue={handleRestartQueueFromZero}
              />

              {/* Dynamic Custom Mouza Registration Form */}
              {showCustomMouzaForm && (
                <form
                  onSubmit={handleAddCustomMouza}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="text-xs font-semibold text-white">
                    Register Custom eporcha.tech Mouza under {activeUpazila.nameEn}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label
                        htmlFor="custom-jl-input"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        JL Number *
                      </label>
                      <input
                        id="custom-jl-input"
                        type="text"
                        value={customJlNo}
                        onChange={(e) => setCustomJlNo(e.target.value)}
                        placeholder="e.g. 125"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono-tabular text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="custom-bn-input"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        Mouza Name (Bengali)
                      </label>
                      <input
                        id="custom-bn-input"
                        type="text"
                        value={customNameBn}
                        onChange={(e) => setCustomNameBn(e.target.value)}
                        placeholder="e.g. দক্ষিণ কাইতলা"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bn text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="custom-en-input"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        Mouza Name (English) *
                      </label>
                      <input
                        id="custom-en-input"
                        type="text"
                        value={customNameEn}
                        onChange={(e) => setCustomNameEn(e.target.value)}
                        placeholder="e.g. Dakshin Kaitala"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="custom-union-input"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        Union Name
                      </label>
                      <input
                        id="custom-union-input"
                        type="text"
                        value={customUnionEn}
                        onChange={(e) => setCustomUnionEn(e.target.value)}
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
                      onClick={() => setShowCustomMouzaForm(false)}
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

              {/* Search Bar & Select/Deselect All Toggle Switch Above Mouza Grid */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="relative flex-1 flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Filter Mouzas by JL number, Bengali name, or English name"
                    value={mouzaSearch}
                    onChange={(e) => setMouzaSearch(e.target.value)}
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
                      {areAllMouzasSelected
                        ? `All ${allMouzasForUpazila.length} Mouzas Selected (100%)`
                        : `${selectedMouzaIds.length} of ${allMouzasForUpazila.length} Selected (Manual Mode)`}
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={areAllMouzasSelected}
                    aria-label="Select/Deselect All Mouzas for current Upazila"
                    onClick={handleToggleSelectDeselectAllMouzas}
                    className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      areAllMouzasSelected
                        ? 'bg-emerald-500'
                        : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                        areAllMouzasSelected
                          ? 'translate-x-6'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Mouza Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[340px] overflow-y-auto pr-1">
                {visibleMouzas.map((mouza) => {
                  const isChecked = selectedMouzaIds.includes(mouza.id);
                  const isKaitalaSouth =
                    mouza.unionNameEn === '20-No Kaitala South Union';
                  
                  // Task Status Logic
                  const mouzaTasks = tasks.filter(t => t.mouzaId === mouza.id);
                  const total = mouzaTasks.length;
                  const successCount = mouzaTasks.filter(t => t.status === 'MAGIC_BYTE_VERIFIED' || t.status === 'HTML_INDEX_EXTRACTED').length;
                  const fetchingCount = mouzaTasks.filter(t => t.status === 'FETCHING_EPORCHA_TECH').length;
                  const failedCount = mouzaTasks.filter(t => t.status === 'FAILED_RETRY').length;
                  
                  let status: 'QUEUED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' = 'QUEUED';
                  if (failedCount > 0) status = 'FAILED';
                  else if (fetchingCount > 0) status = 'IN_PROGRESS';
                  else if (successCount > 0 && successCount === total) status = 'SUCCESS';
                  else if (total > 0 && successCount < total) status = 'IN_PROGRESS';

                  const badgeConfig = {
                    SUCCESS: { label: 'SUCCESS', classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
                    IN_PROGRESS: { label: 'FETCHING', classes: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
                    FAILED: { label: 'FAILED', classes: 'bg-rose-500/20 text-rose-300 border-rose-500/50' },
                    QUEUED: { label: 'QUEUED', classes: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/50' }
                  }[status];

                  return (
                    <button
                      key={mouza.id}
                      type="button"
                      onClick={() => toggleMouzaSelection(mouza.id)}
                      className={`p-3.5 rounded-xl border text-left transition-colors flex items-start gap-3 relative group ${
                        isChecked
                          ? 'bg-slate-950 border-emerald-500/80 text-white'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {/* Tooltip */}
                      {total > 0 && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none border border-slate-700">
                          {successCount} of {total} tasks completed ({Math.round((successCount/total)*100)}%)
                        </div>
                      )}

                      {/* Status Badge */}
                      {total > 0 && (
                        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeConfig.classes}`}>
                          {badgeConfig.label}
                        </div>
                      )}

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
                            {mouza.unionNameBn}
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

            {/* STEP 02: Document Type Selection Menu with "Select All" Button */}
            <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      02. Document Type Selection Menu (ডকুমেন্ট ও ফাইল ফরম্যাট নির্বাচন মেনু)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 font-bn mt-0.5">
                    Click &ldquo;Select All&rdquo; to automatically select all 5 document types and all survey formats found on <code>https://eporcha.tech</code> for the selected Mouzas and immediately fetch them into the download queue.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSelectAllDocumentTypesAndFetch}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-sm"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Select All</span>
                  </button>

                  <a
                    href={ENDPOINT_MODE_META[selectedEndpoints[0] || 'mouza-vittik-khatian'].fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono-tabular text-emerald-400 hover:underline flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <span>
                      {selectedEndpoints.length === ALL_ENDPOINT_TYPES.length
                        ? 'https://eporcha.tech/* (All 5 Endpoints)'
                        : ENDPOINT_MODE_META[selectedEndpoints[0] || 'mouza-vittik-khatian'].fullUrl}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              </div>

              {/* 5 Multi-Selectable Document Mode Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {ALL_ENDPOINT_TYPES.map((modeKey) => {
                  const meta = ENDPOINT_MODE_META[modeKey];
                  const isSelected = selectedEndpoints.includes(modeKey);
                  return (
                    <button
                      key={modeKey}
                      type="button"
                      onClick={() => handleToggleEndpointType(modeKey)}
                      className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-950 border-emerald-500 text-white'
                          : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono-tabular text-emerald-400">
                            {meta.path}
                          </span>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-sm font-bold text-white font-bn mt-1.5">
                          {meta.titleBn}
                        </div>
                        <div className="text-xs font-medium text-slate-300 mt-0.5">
                          {meta.titleEn}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Survey Types & Format Options */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Target Surveys ({selectedSurveys.length}/{ALL_SURVEY_TYPES.length} Selected)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSurveys([...ALL_SURVEY_TYPES]);
                        const chosenMouzas = allMouzasForUpazila.filter((m) =>
                          selectedMouzaIds.includes(m.id)
                        );
                        syncQueueWithSelection({
                          div: activeDivision,
                          dist: activeDistrict,
                          upz: activeUpazila,
                          mouzas: chosenMouzas,
                          endpoints: selectedEndpoints,
                          surveys: [...ALL_SURVEY_TYPES],
                        });
                      }}
                      className="text-xs text-emerald-400 hover:underline font-medium"
                    >
                      Select All Surveys (CS · SA · RS · BS · Mutation)
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SURVEY_TYPES.map((srv) => {
                      const active = selectedSurveys.includes(srv);
                      return (
                        <button
                          key={srv}
                          type="button"
                          onClick={() => toggleSurveyType(srv)}
                          className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors font-bn whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {SURVEY_LABELS[srv].labelBn} · {srv}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="book-layout-select"
                      className="block text-xs text-slate-400 mb-1 font-bn"
                    >
                      বইয়ের ধরন (Book Layout)
                    </label>
                    <select
                      id="book-layout-select"
                      value={bookStyle.layout}
                      onChange={(e) =>
                        setBookStyle({
                          ...bookStyle,
                          layout: e.target.value as 'new' | 'old',
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-bn"
                    >
                      <option value="new">নতুন ধরন (New Format)</option>
                      <option value="old">পুরনো ধরন (Old Format)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="book-color-select"
                      className="block text-xs text-slate-400 mb-1 font-bn"
                    >
                      রঙের ধরন (Color Mode)
                    </label>
                    <select
                      id="book-color-select"
                      value={bookStyle.colorMode}
                      onChange={(e) =>
                        setBookStyle({
                          ...bookStyle,
                          colorMode: e.target.value as 'color' | 'bw',
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-bn"
                    >
                      <option value="color">রঙিন (Color PDF)</option>
                      <option value="bw">সাদা-কালো (Black & White)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Bar & Status Banner */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-slate-300 font-mono-tabular">
                    Selected:{' '}
                    <span className="text-emerald-400 font-bold">
                      {selectedMouzaIds.length}/{allMouzasForUpazila.length} Mouzas
                    </span>{' '}
                    in {activeUpazila.nameEn} ·{' '}
                    <span className="text-emerald-400 font-bold">
                      {selectedEndpoints.length}/5 Document Modes
                    </span>{' '}
                    ·{' '}
                    <span className="text-emerald-400 font-bold">
                      {selectedSurveys.length}/5 Surveys
                    </span>{' '}
                    {allDocsSelected ? '(ALL DOCUMENTS & FORMATS SELECTED)' : ''}
                  </div>
                  {enqueueFeedback && (
                    <div className="text-xs text-emerald-400 font-medium">
                      {enqueueFeedback}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleEnqueueBatch(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <FolderArchive className="w-4 h-4 text-emerald-400" />
                    <span>Rebuild Queue ({tasks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEnqueueBatch(true)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Start Fetching Queue ({tasks.length} Tasks)</span>
                  </button>
                </div>
              </div>
            </section>

            {/* STEP 03: Inline Live Download Queue Preview & ZIP Packager */}
            <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    03. Active Download Queue for {activeUpazila.nameBn} ({activeUpazila.nameEn}) — {tasks.length} Tasks Ready
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Queued: {queuedCount} · Fetched/Extracted: {completedOrExtractedCount} · Verified %PDF-: {verifiedPdfCount}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {!isQueueRunning ? (
                    <button
                      type="button"
                      onClick={() => setIsQueueRunning(true)}
                      disabled={queuedCount === 0}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Queue ({queuedCount})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsQueueRunning(false)}
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Queue</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleBundleZip}
                    disabled={tasks.length === 0 || isBundlingZip}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>
                      {isBundlingZip
                        ? 'Packaging ZIP...'
                        : `Download All Records (.ZIP)`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('queue')}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                  >
                    Open Full Queue Console ({tasks.length})
                  </button>
                </div>
              </div>

              {lastBundleStatus && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{lastBundleStatus}</span>
                </div>
              )}

              {/* Compact Preview of First 8 Tasks in Queue */}
              {tasks.length > 0 && (
                <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-900/60">
                          <th className="py-2.5 px-3">Mouza & JL</th>
                          <th className="py-2.5 px-3">Document Type</th>
                          <th className="py-2.5 px-3">Survey</th>
                          <th className="py-2.5 px-3">Forensic FileName</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {tasks.slice(0, 8).map((task) => {
                          const fetching =
                            activeTaskId === task.id ||
                            task.status === 'FETCHING_EPORCHA_TECH';
                          return (
                            <tr key={task.id} className="hover:bg-slate-900/40">
                              <td className="py-2.5 px-3 font-bn text-white">
                                JL-{task.mouzaJlNo} · {task.mouzaNameBn} ({task.mouzaNameEn})
                              </td>
                              <td className="py-2.5 px-3 font-mono-tabular text-emerald-400">
                                /{task.endpointType}
                              </td>
                              <td className="py-2.5 px-3 font-mono-tabular text-slate-200">
                                {task.surveyType}
                              </td>
                              <td className="py-2.5 px-3 font-mono-tabular text-slate-300 truncate max-w-xs">
                                {task.fileName}
                              </td>
                              <td className="py-2.5 px-3 font-mono-tabular">
                                {fetching ? (
                                  <span className="text-amber-400 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>FETCHING</span>
                                  </span>
                                ) : task.status === 'CACHED_INDEXEDDB' ||
                                  task.status === 'HTML_INDEX_EXTRACTED' ? (
                                  <span className="text-emerald-400">
                                    {task.status} ({((task.byteLength || 0) / 1024).toFixed(1)} KB)
                                  </span>
                                ) : (
                                  <span className="text-slate-400">{task.status}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRunSingleTask(task.id)}
                                  disabled={fetching}
                                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200"
                                >
                                  Fetch Now
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {tasks.length > 8 && (
                    <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>
                        Showing first 8 of {tasks.length} queued documents for {activeUpazila.nameEn}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('queue')}
                        className="text-emerald-400 hover:underline font-medium"
                      >
                        View All {tasks.length} Tasks in Live Queue →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* WORKSPACE VIEW 2: LIVE QUEUE CONSOLE */}
        {activeTab === 'queue' && (
          <div key="view-queue" className="workspace-view-enter">
            <QueueConsoleView
              tasks={tasks}
              isRunning={isQueueRunning}
              activeTaskId={activeTaskId}
              proxyConfig={proxyConfig}
              onUpdateProxyConfig={handleUpdateProxyConfig}
              onStartQueue={() => setIsQueueRunning(true)}
              onPauseQueue={() => setIsQueueRunning(false)}
              onRunSingleTask={handleRunSingleTask}
              onRetryFailed={handleRetryFailed}
              onClearQueue={handleClearQueue}
              onBundleZip={handleBundleZip}
              onExportCsv={handleExportAuditCsv}
              onDownloadIndividual={handleDownloadIndividualTask}
              onOpenBatchRenameModal={() => setBatchRenameModalOpen(true)}
              isBundlingZip={isBundlingZip}
              lastBundleStatus={lastBundleStatus}
            />
          </div>
        )}

        {/* WORKSPACE VIEW 3: OFFLINE TABULAR INDEX */}
        {activeTab === 'index' && (
          <div key="view-index" className="workspace-view-enter">
            <TabularIndexView
              records={tabularRecords}
              onImportRecords={handleImportRecords}
              onClearRecords={handleClearRecords}
            />
          </div>
        )}

        {/* WORKSPACE VIEW 4: 6-DOC ARCHITECTURE VIEWER */}
        {activeTab === 'docs' && (
          <div key="view-docs" className="workspace-view-enter">
            <ArchitectureDocsView />
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 px-4 sm:px-8 py-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          LR Mass Downloader (LandArchive BD / LRgetBD v2.1) · Powered by open-access{' '}
          <a
            href="https://eporcha.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            https://eporcha.tech
          </a>
        </div>
        <div className="font-bn">
          ব্রাহ্মণবাড়িয়া · নবীনগর · ২০নং কাইতলা দক্ষিণ ইউনিয়ন (গোয়ালী · কাইতলা) · কুমিল্লা
        </div>
      </footer>

      {/* Android APK & Native CapacitorHttp Modal */}
      <ApkInstallerModal
        isOpen={apkModalOpen}
        onClose={() => setApkModalOpen(false)}
      />

      {/* Batch Rename Modal for lr_verified_blobs & Queue */}
      <BatchRenameModal
        isOpen={batchRenameModalOpen}
        onClose={() => setBatchRenameModalOpen(false)}
        tasks={tasks}
        verifiedBlobTaskIds={verifiedBlobTaskIds}
        onApplyRename={handleApplyBatchRename}
      />

      {/* Google Drive & Cloud Storage Sync Modal */}
      <GoogleDriveSyncModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        tasks={tasks}
        localRecords={tabularRecords}
        onImportCloudRecords={(cloudRecords) => {
          handleImportRecords(cloudRecords);
        }}
      />
    </div>
  );
}
