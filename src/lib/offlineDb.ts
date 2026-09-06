/**
 * Utility for local-first storage using native IndexedDB.
 * Manages cache snapshots for offline reading and pending sync queue items.
 */

const DB_NAME = "AvariasOfflineDB";
const DB_VERSION = 1;

export interface AppMetadata {
  lastSync?: string;
  version?: number;
  userId?: string;
  syncStatus?: "synced" | "pending" | "error";
  pendingCount?: number;
}

export interface SyncQueueItem {
  id: string;
  type: "QUANTITY_DELTA" | "UPDATE_FIELD" | "ADD" | "DELETE";
  table: string;
  recordId?: string | number;
  field?: string;
  delta?: number;
  changes?: Record<string, any>;
  original?: Record<string, any>;
  audit?: Record<string, any>;
  createdAt: string;
  status: "pending" | "syncing" | "error";
  retryCount: number;
  errorMessage?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB não suportado neste navegador."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("mapeamento")) {
        db.createObjectStore("mapeamento", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("posicoes")) {
        db.createObjectStore("posicoes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("produtos")) {
        db.createObjectStore("produtos", { keyPath: "produto" });
      }
      if (!db.objectStoreNames.contains("registros")) {
        db.createObjectStore("registros", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save array of records to a specific ObjectStore */
export async function saveSnapshot<T extends Record<string, any>>(storeName: string, items: T[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    store.clear(); // Clear existing snapshot to keep database fresh
    items.forEach((item) => {
      if (item && typeof item === "object") {
        store.put(item);
      }
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Falha ao salvar snapshot em ${storeName}:`, err);
  }
}

/** Retrieve all items from a specific ObjectStore */
export async function getSnapshot<T = any>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Falha ao carregar snapshot de ${storeName}:`, err);
    return [];
  }
}

/** Save metadata key/value */
export async function setMetadata(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("metadata", "readwrite");
    const store = tx.objectStore("metadata");
    store.put({ key, value, updatedAt: new Date().toISOString() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Erro ao salvar metadata:", err);
  }
}

/** Retrieve metadata by key */
export async function getMetadata<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction("metadata", "readonly");
    const store = tx.objectStore("metadata");
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Erro ao buscar metadata:", err);
    return null;
  }
}

/** Add item to pending sync queue */
export async function enqueueSyncOperation(item: Omit<SyncQueueItem, "id" | "createdAt" | "status" | "retryCount">): Promise<SyncQueueItem> {
  const queueItem: SyncQueueItem = {
    ...item,
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0
  };

  try {
    const db = await openDB();
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    store.put(queueItem);

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Erro ao enfileirar operação:", err);
  }

  return queueItem;
}

/** Get all pending items from sync queue */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("sync_queue", "readonly");
    const store = tx.objectStore("sync_queue");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Erro ao obter fila de sincronização:", err);
    return [];
  }
}

/** Remove item from sync queue after successful sync */
export async function removeSyncQueueItem(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Erro ao remover item da fila:", err);
  }
}
