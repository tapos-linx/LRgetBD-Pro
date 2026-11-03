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
  calculatePoliteJitterDelay,
  calculateQueueProgress,
  generateManifestAuditCsv,
  moveQueueTaskByOffset,
  prioritizeMouzaInQueue,
  processSingleQueueTask,
  reorderQueueTasks,
  requeueIntegrityFlaggedTasks,
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
import { PortalAlertsView } from './components/PortalAlertsView';
import { IntegrityHealthView } from './components/IntegrityHealthView';
import { TabularIndexView } from './components/TabularIndexView';
import { ArchitectureDocsView } from './components/ArchitectureDocsView';
import { useCascadingGeo } from './hooks/useCascadingGeo';
import { NationwideAreaSelection } from './components/NationwideAreaSelection';

type ActiveWorkspaceTab = 'extractor' | 'queue' | 'integrity' | 'index' | 'docs';

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

  // Geographic Cascading State using Unified Discovery Hook (Phase 3 & 4)
  const geo = useCascadingGeo();

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
    return loadPersistedQueue();
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

  // Automatic Queue Generation upon discovery/selection change (Phase 5 & 6)
  useEffect(() => {
    if (!geo.activeDivision || !geo.activeDistrict || !geo.activeUpazila || geo.selectedCount === 0) {
      if (geo.selectedCount === 0 && tasks.length > 0) {
        setTasks([]);
        savePersistedQueue([]);
      }
      return;
    }

    const builtTasks = generateTasksForMouzasAndEndpoints({
      divisionNameEn: geo.activeDivision.nameEn,
      divisionSlug: geo.activeDivision.eporchaSlug,
      districtNameEn: geo.activeDistrict.nameEn,
      districtNameBn: geo.activeDistrict.nameBn,
      districtSlug: geo.activeDistrict.eporchaSlug,
      upazilaNameEn: geo.activeUpazila.nameEn,
      upazilaNameBn: geo.activeUpazila.nameBn,
      upazilaSlug: geo.activeUpazila.eporchaSlug,
      mouzas: geo.allMouzasForUpazila.filter(m => geo.selectedMouzaIds.includes(m.id)),
      endpoints: selectedEndpoints,
      surveys: selectedSurveys,
      bookStyle,
      khatianNo: khatianInput.trim() || 'ALL',
      mapSheetNo: mapSheetInput || 1,
    });

    setTasks(builtTasks);
    savePersistedQueue(builtTasks);
    setEnqueueFeedback(`Queue updated with ${builtTasks.length} tasks for ${geo.selectedCount} Mouzas.`);
  }, [
    geo.activeUpazila?.id, 
    geo.selectedMouzaIds, 
    selectedEndpoints, 
    selectedSurveys, 
    bookStyle, 
    khatianInput, 
    mapSheetInput
  ]);

  // Restart queue from Queue Index 0
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
      `Queue reset: Sequential processing restarted for all ${geo.selectedCount} Mouzas.`
    );
  };

  const handleExportMouzaMetadata = () => {
    const exportData = geo.allMouzasForUpazila.filter(m => geo.selectedMouzaIds.includes(m.id)).map((m) => ({
      jlNo: m.jlNo,
      nameEn: m.nameEn,
      nameBn: m.nameBn,
      unionNameEn: m.unionNameEn,
      unionNameBn: m.unionNameBn,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected_mouzas_${geo.activeUpazila?.nameEn}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectAllDocumentTypesAndFetch = () => {
    if (!geo.activeUpazila) return;
    
    geo.setMouzaSearch('');
    setActiveTaskId(null);

    const allEndpoints: EporchaEndpointType[] = [...ALL_ENDPOINT_TYPES];
    const allSurveys: SurveyType[] = [...ALL_SURVEY_TYPES];
    
    setSelectedEndpoints(allEndpoints);
    setSelectedSurveys(allSurveys);
    geo.selectAllMouzas();
    setIsQueueRunning(true);
    setEnqueueFeedback(`Global selection: All Mouzas and all document modes queued.`);
  };

  const handleToggleEndpointType = (modeKey: EporchaEndpointType) => {
    setSelectedEndpoints(prev => 
      prev.includes(modeKey)
        ? prev.length > 1 ? prev.filter(k => k !== modeKey) : prev
        : [...prev, modeKey]
    );
    setActiveTaskId(null);
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

  const handleUpdateProxyConfig = (next: ProxyConfig) => {
    setProxyConfig(next);
    saveProxyConfig(next);
  };

  const handleReorderTasks = useCallback(
    (sourceTaskId: string, targetTaskId: string) => {
      setTasks((prev) => {
        const reordered = reorderQueueTasks(prev, sourceTaskId, targetTaskId);
        savePersistedQueue(reordered);
        return reordered;
      });
    },
    []
  );

  const handleMoveTaskPriority = useCallback(
    (taskId: string, direction: 'UP' | 'DOWN' | 'TOP') => {
      setTasks((prev) => {
        const reordered = moveQueueTaskByOffset(prev, taskId, direction);
        savePersistedQueue(reordered);
        return reordered;
      });
    },
    []
  );

  const handlePrioritizeMouza = useCallback((mouzaId: string) => {
    setTasks((prev) => {
      const reordered = prioritizeMouzaInQueue(prev, mouzaId);
      savePersistedQueue(reordered);
      return reordered;
    });
  }, []);

  const handleBulkAction = useCallback(
    (taskIds: string[], action: 'FORCE_FETCH' | 'DELETE' | 'MOVE_TO_TOP') => {
      if (taskIds.length === 0) return;

      setTasks((prev) => {
        let next = [...prev];

        if (action === 'DELETE') {
          next = next.filter((t) => !taskIds.includes(t.id));
        } else if (action === 'FORCE_FETCH') {
          next = next.map((t) =>
            taskIds.includes(t.id)
              ? {
                  ...t,
                  status: 'QUEUED' as const,
                  pdfVerified: false,
                  retries: 0,
                  errorMessage: undefined,
                }
              : t
          );
        } else if (action === 'MOVE_TO_TOP') {
          const toMove = next.filter((t) => taskIds.includes(t.id));
          const remaining = next.filter((t) => !taskIds.includes(t.id));
          next = [...toMove, ...remaining];
        }

        savePersistedQueue(next);
        return next;
      });

      setEnqueueFeedback(`Bulk ${action.toLowerCase().replace('_', ' ')} applied to ${taskIds.length} tasks.`);
      if (action === 'FORCE_FETCH' && !isQueueRunning) {
        setIsQueueRunning(true);
      }
    },
    [isQueueRunning]
  );

  const toggleSurveyType = (srv: SurveyType) => {
    setSelectedSurveys(prev => 
      prev.includes(srv)
        ? prev.length > 1 ? prev.filter(s => s !== srv) : prev
        : [...prev, srv]
    );
    setActiveTaskId(null);
  };

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

  const queueStepCounterRef = useRef(0);
  const queuePreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const activePreviewRowRef = useRef<HTMLTableRowElement | null>(null);
  const [autoScrollPreview, setAutoScrollPreview] = useState(true);

  const currentTrackedTaskId = useMemo(() => {
    if (activeTaskId) return activeTaskId;
    const fetchingTask = tasks.find((t) => t.status === 'FETCHING_EPORCHA_TECH');
    if (fetchingTask) return fetchingTask.id;
    if (isQueueRunning) {
      const nextQueued = tasks.find((t) => t.status === 'QUEUED');
      if (nextQueued) return nextQueued.id;
    }
    return null;
  }, [activeTaskId, tasks, isQueueRunning]);

  useEffect(() => {
    if (!autoScrollPreview || activeTab !== 'extractor' || !currentTrackedTaskId) {
      return;
    }
    const container = queuePreviewContainerRef.current;
    const activeRow = activePreviewRowRef.current;
    if (!container || !activeRow) return;

    const containerHeight = container.clientHeight;
    const rowTop = activeRow.offsetTop;
    const rowHeight = activeRow.offsetHeight;
    const targetScrollTop = Math.max(
      0,
      rowTop - containerHeight / 2 + rowHeight / 2
    );

    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }, [currentTrackedTaskId, autoScrollPreview, activeTab]);

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

  const handleRequeueIntegrityFlagged = useCallback(
    (filter?: { mouzaId?: string; endpointType?: EporchaEndpointType }) => {
      setTasks((prev) => {
        const { updatedTasks } = requeueIntegrityFlaggedTasks(prev, filter);
        savePersistedQueue(updatedTasks);
        return updatedTasks;
      });
    },
    []
  );

  const handleDownloadIndividualTask = async (task: QueueTask) => {
    const success = await triggerIndividualPdfDownload(task);
    if (!success) {
      setEnqueueFeedback(`Binary for ${task.fileName} is not in cache yet.`);
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
    setLastBundleStatus('Preparing structured ZIP archive...');
    try {
      const { zipBlob, verifiedPdfCount, auditFileName } =
        await bundleTasksToStructuredZip({
          tasks,
          onProgress: (percent, statusText) => {
            setLastBundleStatus(`${percent}%: ${statusText}`);
          },
        });
      triggerZipDownload(zipBlob, auditFileName);
      setLastBundleStatus(`Successfully downloaded ${auditFileName}`);
    } catch (error) {
      setLastBundleStatus(`ZIP packaging error: ${error instanceof Error ? error.message : String(error)}`);
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
  const completedOrExtractedCount = queueMetrics.completedCount;
  const nativeCapActive = isCapacitorNativeRuntime();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
        <header className="px-3 sm:px-8 py-3 flex items-center justify-between gap-2 sm:gap-8">
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

          <nav
            aria-label="Primary Workspace Navigation"
            className="hidden md:flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-800/80 backdrop-blur-sm"
          >
            {[
              { id: 'extractor', label: 'Extractor' },
              { id: 'queue', label: `Live Queue (${tasks.length})` },
              { id: 'integrity', label: 'Integrity Health' },
              { id: 'index', label: `Tabular Index (${tabularRecords.length})` },
              { id: 'docs', label: 'Architecture' },
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

          <div className="flex items-center shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setDriveModalOpen(true)}
              className="px-2.5 py-2 sm:px-3 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Google Drive</span>
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

        <GlobalProgressBar
          metrics={queueMetrics}
          isQueueRunning={isQueueRunning}
          activeTab={activeTab}
          onViewQueue={() => setActiveTab('queue')}
          onToggleQueue={() => setIsQueueRunning((prev) => !prev)}
        />
      </div>

      <div className="md:hidden flex items-center justify-around border-b border-slate-800 bg-slate-900 px-2 py-1.5 gap-1 overflow-x-auto">
        {[
          { id: 'extractor', label: 'Extractor' },
          { id: 'queue', label: `Queue (${tasks.length})` },
          { id: 'integrity', label: 'Integrity' },
          { id: 'index', label: `Index (${tabularRecords.length})` },
          { id: 'docs', label: 'Docs' },
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

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
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
                  ? 'Native Capacitor HTTP'
                  : proxyConfig.preferredMode}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Status:{' '}
                {portalHealth.checked
                  ? portalHealth.reachable
                    ? `HTTP ${portalHealth.status} (${portalHealth.latencyMs}ms)`
                    : 'Relay Active'
                  : 'Checking...'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              LandArchive BD: Nationwide Geographic Data Extractor
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular text-slate-300 shrink-0">
            <div>
              <span className="text-slate-400">Total Mouzas: </span>
              <span className="text-emerald-400 font-bold">
                {geo.totalMouzasCount}
              </span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div>
              <span className="text-slate-400">Selected: </span>
              <span className="text-white font-semibold">
                {geo.selectedCount}
              </span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div>
              <span className="text-slate-400">Queue: </span>
              <span className="text-amber-400 font-semibold">
                {tasks.length} Tasks
              </span>
            </div>
          </div>
        </section>

        {activeTab === 'extractor' && (
          <div key="view-extractor" className="space-y-6 workspace-view-enter">
            <PortalAlertsView />
            
            <NationwideAreaSelection geo={geo} />

            <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>02. Document Mode & Survey Filter</span>
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                   <button
                    type="button"
                    onClick={handleSelectAllDocumentTypesAndFetch}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Fetch ALL Modes (Total Coverage)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMouzaMetadata}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Export Metadata</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ALL_ENDPOINT_TYPES.map((modeKey) => {
                  const meta = ENDPOINT_MODE_META[modeKey];
                  const isSelected = selectedEndpoints.includes(modeKey);
                  return (
                    <button
                      key={modeKey}
                      type="button"
                      onClick={() => handleToggleEndpointType(modeKey)}
                      className={`p-3.5 rounded-xl border text-left transition-all duration-200 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {meta.docType.replace(/_/g, ' ')}
                        </span>
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-700" />
                        )}
                      </div>
                      <div className="text-[13px] font-bold text-white mb-1">{meta.titleBn}</div>
                      <div className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{meta.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      Active Survey Records
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_SURVEY_TYPES.map((srv) => {
                        const isSelected = selectedSurveys.includes(srv);
                        return (
                          <button
                            key={srv}
                            type="button"
                            onClick={() => toggleSurveyType(srv)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {SURVEY_LABELS[srv].labelBn}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 md:text-right">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      Book Style & Layout
                    </label>
                    <div className="flex flex-wrap md:justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setBookStyle(prev => ({ ...prev, layout: prev.layout === 'new' ? 'old' : 'new' }))}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-semibold"
                      >
                        Format: {bookStyle.layout === 'new' ? 'New (Modern)' : 'Old (Classic)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookStyle(prev => ({ ...prev, colorMode: prev.colorMode === 'color' ? 'bw' : 'color' }))}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-semibold"
                      >
                        Print: {bookStyle.colorMode === 'color' ? 'Full Color' : 'B&W'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 pt-3 border-t border-slate-900">
                   <div className="flex-1 w-full space-y-1.5">
                    <label className="block text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                      Khatian Filter (ALL or specific number)
                    </label>
                    <input
                      type="text"
                      value={khatianInput}
                      onChange={(e) => setKhatianInput(e.target.value)}
                      placeholder="ALL"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex-1 w-full space-y-1.5">
                    <label className="block text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                      Map Sheet Index
                    </label>
                    <input
                      type="number"
                      value={mapSheetInput}
                      onChange={(e) => setMapSheetInput(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col max-h-[700px]">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>03. Mouza Visibility & Manual Toggle</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search Mouza..."
                        value={geo.mouzaSearch}
                        onChange={(e) => geo.setMouzaSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {geo.visibleMouzas.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-slate-700" />
                      </div>
                      <p className="text-xs text-slate-500">No Mouzas discovered for this selection.</p>
                    </div>
                  ) : (
                    geo.visibleMouzas.map((m) => {
                      const isSelected = geo.selectedMouzaIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => geo.toggleMouza(m.id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-4 ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500/40'
                              : 'bg-slate-950/40 border-slate-900 hover:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-950 border-slate-800'
                            }`}>
                              {isSelected && <CheckSquare className="w-3.5 h-3.5 text-slate-950" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white font-bn">
                                {m.nameBn} ({m.nameEn})
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono-tabular">
                                JL: {m.jlNo} · {m.unionNameEn}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                             <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Queued
                             </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <div className="text-slate-400">
                    Selected: <span className="text-emerald-400 font-bold">{geo.selectedCount}</span> / {geo.totalMouzasCount}
                  </div>
                  <button
                    onClick={geo.invertSelection}
                    className="text-slate-500 hover:text-slate-300 font-semibold uppercase tracking-widest text-[10px]"
                  >
                    Invert Selection
                  </button>
                </div>
              </section>

              <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col max-h-[700px]">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 text-amber-400 shrink-0 ${isQueueRunning ? 'animate-spin' : ''}`} />
                    <span>04. Queue Preview & Sequence Control</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQueueRunning(!isQueueRunning)}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all ${
                        isQueueRunning
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-600 text-white shadow-sm'
                      }`}
                    >
                      {isQueueRunning ? (
                        <><Pause className="w-3 h-3" /> Pause Sequence</>
                      ) : (
                        <><Play className="w-3 h-3" /> Resume Sequence</>
                      )}
                    </button>
                  </div>
                </div>

                <div 
                  ref={queuePreviewContainerRef}
                  className="flex-1 overflow-y-auto pr-1 custom-scrollbar border border-slate-950 rounded-xl bg-slate-950/50"
                >
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase">Sequence</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase">Target Record</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-20 text-center text-[11px] text-slate-500">
                            No tasks in queue. Select Mouzas and Document Modes to begin.
                          </td>
                        </tr>
                      ) : (
                        tasks.map((task, idx) => {
                          const isActive = task.id === currentTrackedTaskId;
                          return (
                            <tr
                              key={task.id}
                              ref={isActive ? activePreviewRowRef : null}
                              className={`border-b border-slate-900/50 transition-colors ${
                                isActive ? 'bg-emerald-500/10' : 'hover:bg-slate-900/40'
                              }`}
                            >
                              <td className="px-3 py-2.5 text-[11px] font-mono-tabular text-slate-400">
                                #{String(idx + 1).padStart(3, '0')}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="text-[11px] font-bold text-white truncate max-w-[200px]">
                                  {task.mouzaNameBn} · {task.surveyType}
                                </div>
                                <div className="text-[9px] text-slate-500 truncate max-w-[200px]">
                                  {ENDPOINT_MODE_META[task.endpointType].badgeBn}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className={`text-[9px] font-bold uppercase tracking-widest ${
                                  task.status === 'QUEUED' ? 'text-slate-500' :
                                  task.status === 'CACHED_INDEXEDDB' ? 'text-emerald-400' :
                                  task.status === 'FETCHING_EPORCHA_TECH' ? 'text-amber-400 animate-pulse' :
                                  'text-rose-400'
                                }`}>
                                  {task.status.replace(/_/g, ' ')}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 flex flex-col gap-3">
                   {enqueueFeedback && (
                    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                      {enqueueFeedback}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRestartQueueFromZero}
                      className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 border border-slate-700"
                    >
                      Clear Progress & Start Over
                    </button>
                    <button
                      onClick={() => setAutoScrollPreview(!autoScrollPreview)}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold border ${
                        autoScrollPreview ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {autoScrollPreview ? 'Auto-Scroll ON' : 'Auto-Scroll OFF'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div key="view-queue" className="workspace-view-enter">
            <QueueConsoleView
              tasks={tasks}
              isQueueRunning={isQueueRunning}
              activeTaskId={activeTaskId}
              onToggleQueue={() => setIsQueueRunning(!isQueueRunning)}
              onRunSingleTask={handleRunSingleTask}
              onRetryFailed={handleRetryFailed}
              onClearQueue={handleClearQueue}
              onExportAuditCsv={handleExportAuditCsv}
              onBundleZip={handleBundleZip}
              isBundlingZip={isBundlingZip}
              lastBundleStatus={lastBundleStatus}
              proxyConfig={proxyConfig}
              onUpdateProxyConfig={handleUpdateProxyConfig}
              onReorderTasks={handleReorderTasks}
              onMoveTaskPriority={handleMoveTaskPriority}
              onPrioritizeMouza={handlePrioritizeMouza}
              onDownloadTask={handleDownloadIndividualTask}
              onBulkAction={handleBulkAction}
              verifiedBlobTaskIds={verifiedBlobTaskIds}
              onBatchRename={() => setBatchRenameModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'integrity' && (
          <div key="view-integrity" className="workspace-view-enter">
            <IntegrityHealthView
              tasks={tasks}
              onRequeueFlagged={handleRequeueIntegrityFlagged}
              onRunSingleTask={handleRunSingleTask}
            />
          </div>
        )}

        {activeTab === 'index' && (
          <div key="view-index" className="workspace-view-enter">
            <TabularIndexView
              records={tabularRecords}
              onImport={handleImportRecords}
              onClear={handleClearRecords}
            />
          </div>
        )}

        {activeTab === 'docs' && (
          <div key="view-docs" className="workspace-view-enter">
            <ArchitectureDocsView />
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="text-sm font-bold text-white tracking-tight">LandArchive BD (LRgetBD-Pro)</div>
            <div className="text-xs text-slate-500">Authorized Geographic Data Archive Tool v2.1</div>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            <a href="#" className="hover:text-emerald-400 transition-colors">Forensic Integrity</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Zero synthetic PDFs</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Nationwide Coverage</a>
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            BUILD_VER: 2024.11.03.PRO · CANONICAL_ID: LRgetBD-Pro
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ApkInstallerModal open={apkModalOpen} onOpenChange={setApkModalOpen} />
      <GoogleDriveSyncModal open={driveModalOpen} onOpenChange={setDriveModalOpen} user={currentUser} />
      <BatchRenameModal
        open={batchRenameModalOpen}
        onOpenChange={setBatchRenameModalOpen}
        tasks={tasks}
        verifiedBlobTaskIds={verifiedBlobTaskIds}
        onApplyRename={handleApplyBatchRename}
      />
    </div>
  );
}
