import { supabase } from "@/lib/supabase";
import {
  getSyncQueue,
  removeSyncQueueItem,
  enqueueSyncOperation,
  SyncQueueItem,
  setMetadata,
  getMetadata
} from "@/lib/offlineDb";

export type ConnectionStatus = "online" | "offline" | "syncing" | "error";

export interface SyncManagerListener {
  (status: ConnectionStatus, pendingCount: number): void;
}

class SyncManager {
  private listeners: Set<SyncManagerListener> = new Set();
  private isProcessing = false;
  private currentStatus: ConnectionStatus = "online";

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange());
      window.addEventListener("offline", () => this.handleNetworkChange());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.handleNetworkChange();
        }
      });

      // Periodic connection and queue check every 30 seconds
      setInterval(() => {
        this.checkAndSync();
      }, 30000);
    }
  }

  public subscribe(listener: SyncManagerListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => this.listeners.delete(listener);
  }

  private async notifyListeners() {
    const queue = await getSyncQueue();
    this.listeners.forEach((listener) => listener(this.currentStatus, queue.length));
  }

  /** Check real internet connectivity with Supabase */
  public async checkRealConnection(): Promise<boolean> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const { error } = await supabase
        .from("posicoes")
        .select("id", { head: true, count: "exact" })
        .limit(1);

      clearTimeout(timeoutId);
      return !error;
    } catch {
      return false;
    }
  }

  public async handleNetworkChange() {
    const isConnected = await this.checkRealConnection();
    this.currentStatus = isConnected ? "online" : "offline";
    await this.notifyListeners();

    if (isConnected) {
      await this.syncPendingQueue();
    }
  }

  /** Add an operation to the sync queue (Fase 3) */
  public async addOperation(op: {
    type: "QUANTITY_DELTA" | "UPDATE_FIELD" | "ADD" | "DELETE";
    table: string;
    recordId?: string | number;
    field?: string;
    delta?: number;
    changes?: Record<string, any>;
    original?: Record<string, any>;
    audit?: Record<string, any>;
  }): Promise<SyncQueueItem> {
    const queuedItem = await enqueueSyncOperation(op);
    
    // Attempt immediate sync if online
    const isOnline = await this.checkRealConnection();
    if (isOnline) {
      this.syncPendingQueue().catch((err) =>
        console.warn("[SyncManager] Tentativa de sync imediato falhou:", err)
      );
    } else {
      this.currentStatus = "offline";
      await this.notifyListeners();
    }

    return queuedItem;
  }

  /** Process the sync queue sequentially with smart conflict resolution (Fase 4) */
  public async syncPendingQueue(): Promise<{ success: boolean; processed: number }> {
    if (this.isProcessing) return { success: false, processed: 0 };
    
    const isOnline = await this.checkRealConnection();
    if (!isOnline) {
      this.currentStatus = "offline";
      await this.notifyListeners();
      return { success: false, processed: 0 };
    }

    this.isProcessing = true;
    this.currentStatus = "syncing";
    await this.notifyListeners();

    let processedCount = 0;
    try {
      const queue = await getSyncQueue();
      
      for (const item of queue) {
        try {
          await this.processItem(item);
          await removeSyncQueueItem(item.id);
          processedCount++;
        } catch (itemErr: any) {
          console.error(`[SyncManager] Erro ao sincronizar item ${item.id}:`, itemErr);
          // Don't halt entire queue on individual error
        }
      }

      const remaining = await getSyncQueue();
      this.currentStatus = remaining.length > 0 ? "error" : "online";
      await setMetadata("lastSync", new Date().toISOString());
      await setMetadata("syncStatus", remaining.length > 0 ? "error" : "synced");
    } catch (err) {
      console.error("[SyncManager] Erro geral na sincronização da fila:", err);
      this.currentStatus = "error";
    } finally {
      this.isProcessing = false;
      await this.notifyListeners();
    }

    return { success: true, processed: processedCount };
  }

  /** Smart conflict resolution processor for individual items */
  private async processItem(item: SyncQueueItem): Promise<void> {
    const { table, type, recordId, field, delta, changes, original } = item;

    if (type === "QUANTITY_DELTA" && recordId && field && delta !== undefined) {
      // Delta Operation: Read live server record, calculate new value from delta
      const { data: liveData, error: fetchErr } = await supabase
        .from(table)
        .select("*")
        .eq("id", recordId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (liveData) {
        const currentLiveQty = Number(liveData[field]) || 0;
        const newCalculatedQty = Math.max(0, currentLiveQty + delta);

        const { error: updErr } = await supabase
          .from(table)
          .update({ [field]: newCalculatedQty })
          .eq("id", recordId);

        if (updErr) throw updErr;
      }
    } else if (type === "UPDATE_FIELD" && recordId && changes) {
      // Absolute Field Update with Last-Write-Wins
      const { error: updErr } = await supabase
        .from(table)
        .update(changes)
        .eq("id", recordId);

      if (updErr) throw updErr;
    } else if (type === "ADD" && changes) {
      // New Record Insertion
      const cleanPayload = { ...changes };
      delete cleanPayload.id; // Let DB generate ID if temporary local ID was used

      const { error: insErr } = await supabase.from(table).insert(cleanPayload);
      if (insErr) throw insErr;
    } else if (type === "DELETE" && recordId) {
      // Record Deletion / Move to Floor or Retrabalho
      const { error: delErr } = await supabase.from(table).delete().eq("id", recordId);
      if (delErr) throw delErr;

      // Handle re-insertion into target position if specified
      if (changes && (changes.targetPosition || changes['Posição'])) {
        const targetPos = changes.targetPosition || changes['Posição'];
        const { error: insErr } = await supabase.from(table).insert({
          'Posição': targetPos,
          'Código': changes['Código'] || changes.sku,
          'Quantidade': changes['Quantidade'] || changes.quantidade || 0,
          'Nível': 0,
          'Profundidade': 1,
          'Parte Tombada': changes['Parte Tombada'] || 0,
          'Parte Molhada': changes['Parte Molhada'] || 0,
          'Id Palete': null
        });
        if (insErr) throw insErr;
      }
    }
  }

  public async checkAndSync() {
    const isOnline = await this.checkRealConnection();
    if (isOnline) {
      const queue = await getSyncQueue();
      if (queue.length > 0) {
        await this.syncPendingQueue();
      }
    } else {
      this.currentStatus = "offline";
      await this.notifyListeners();
    }
  }
}

export const syncManager = new SyncManager();
