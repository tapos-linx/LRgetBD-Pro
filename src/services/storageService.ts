import {
  KhatianRecord,
  ProxyConfig,
  QueueTask,
  VerifiedBlobRecord,
} from '../types/land';
import { detectDefaultTransportMode } from './eporchaTechClient';

const DB_NAME = 'LandArchiveBD_v2';
const DB_VERSION = 2;
const BLOB_STORE = 'lr_eporcha_blobs_v2';
const ALIAS_BLOB_STORE = 'lr_verified_blobs';
const RECORD_STORE = 'lr_eporcha_records_v2';

const QUEUE_STORAGE_KEY = 'lr_eporcha_queue_v2';
const PROXY_CONFIG_KEY = 'lr_eporcha_proxy_config_v2';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'taskId' });
      }
      if (!db.objectStoreNames.contains(ALIAS_BLOB_STORE)) {
        db.createObjectStore(ALIAS_BLOB_STORE, { keyPath: 'taskId' });
      }
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        db.createObjectStore(RECORD_STORE, { keyPath: 'recordId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVerifiedPdfBlob(record: VerifiedBlobRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const storeNames = [BLOB_STORE];
    if (db.objectStoreNames.contains(ALIAS_BLOB_STORE)) {
      storeNames.push(ALIAS_BLOB_STORE);
    }
    const tx = db.transaction(storeNames, 'readwrite');
    tx.objectStore(BLOB_STORE).put(record);
    if (db.objectStoreNames.contains(ALIAS_BLOB_STORE)) {
      tx.objectStore(ALIAS_BLOB_STORE).put(record);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function batchUpdateVerifiedBlobFileNames(
  renameMap: Map<string, string>
): Promise<{ updatedCount: number }> {
  if (renameMap.size === 0) return { updatedCount: 0 };
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const storeNames = [BLOB_STORE];
    if (db.objectStoreNames.contains(ALIAS_BLOB_STORE)) {
      storeNames.push(ALIAS_BLOB_STORE);
    }
    const tx = db.transaction(storeNames, 'readwrite');
    const primaryStore = tx.objectStore(BLOB_STORE);
    const aliasStore = db.objectStoreNames.contains(ALIAS_BLOB_STORE)
      ? tx.objectStore(ALIAS_BLOB_STORE)
      : null;

    let updatedCount = 0;
    const req = primaryStore.openCursor();

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const record = cursor.value as VerifiedBlobRecord;
        if (renameMap.has(record.taskId)) {
          const newName = renameMap.get(record.taskId)!;
          if (newName && newName !== record.fileName) {
            record.fileName = newName;
            cursor.update(record);
            if (aliasStore) {
              aliasStore.put(record);
            }
            updatedCount++;
          }
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve({ updatedCount });
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getVerifiedPdfBlob(
  taskId: string
): Promise<VerifiedBlobRecord | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).get(taskId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result as VerifiedBlobRecord | undefined);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getAllVerifiedPdfBlobs(): Promise<VerifiedBlobRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as VerifiedBlobRecord[]) || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function clearAllVerifiedPdfBlobs(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const storeNames = [BLOB_STORE];
    if (db.objectStoreNames.contains(ALIAS_BLOB_STORE)) {
      storeNames.push(ALIAS_BLOB_STORE);
    }
    const tx = db.transaction(storeNames, 'readwrite');
    tx.objectStore(BLOB_STORE).clear();
    if (db.objectStoreNames.contains(ALIAS_BLOB_STORE)) {
      tx.objectStore(ALIAS_BLOB_STORE).clear();
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveExtractedKhatianRecords(records: KhatianRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, 'readwrite');
    const store = tx.objectStore(RECORD_STORE);
    for (const rec of records) {
      store.put(rec);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAllExtractedKhatianRecords(): Promise<KhatianRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(RECORD_STORE, 'readonly');
      const req = tx.objectStore(RECORD_STORE).getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result as KhatianRecord[]) || []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return [];
  }
}

export async function clearExtractedKhatianRecords(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, 'readwrite');
    tx.objectStore(RECORD_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function loadPersistedQueue(): QueueTask[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePersistedQueue(tasks: QueueTask[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Ignore storage quota warnings on large lists
  }
}

export function loadProxyConfig(): ProxyConfig {
  const defaultConfig: ProxyConfig = {
    preferredMode: detectDefaultTransportMode(),
    termuxProxyUrl: 'http://127.0.0.1:8787/proxy?url=',
    customCloudflareProxyUrl: '',
    concurrency: 1,
    minDelayMs: 600,
    maxDelayMs: 1200,
  };
  try {
    const raw = localStorage.getItem(PROXY_CONFIG_KEY);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    return {
      ...defaultConfig,
      ...parsed,
    };
  } catch {
    return defaultConfig;
  }
}

export function saveProxyConfig(config: ProxyConfig): void {
  try {
    localStorage.setItem(PROXY_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore
  }
}
