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
      setInterval(() => { this.checkAndSync(); }, 30000);
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

  public async checkRealConnection(): Promise<boolean> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    try {
      const { error } = await supabase.from("mapeamento").select("id").limit(1);
      return !error;
    } catch { return false; }
  }

  public async handleNetworkChange() {
    const isConnected = await this.checkRealConnection();
    this.currentStatus = isConnected ? "online" : "offline";
    await this.notifyListeners();
    if (isConnected) await this.syncPendingQueue();
  }

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
          await this.logToAuditTable(item, "error", itemErr?.message);
        }
      }
      const remaining = await getSyncQueue();
      this.currentStatus = remaining.length > 0 ? "error" : "online";
      await setMetadata("lastSync", new Date().toISOString());
      await setMetadata("syncStatus", remaining.length > 0 ? "error" : "synced");
    } catch (err) {
      console.error("[SyncManager] Erro geral na sincronizacao:", err);
      this.currentStatus = "error";
    } finally {
      this.isProcessing = false;
      await this.notifyListeners();
    }
    return { success: true, processed: processedCount };
  }

  // ── Floor helpers ─────────────────────────────────────────────────────────

  private async consumeFromFloor(skuCode: string, qty: number): Promise<void> {
    if (!skuCode || qty <= 0) return;
    const { data: floorData, error: fFetchErr } = await supabase
      .from("mapeamento").select("id, Quantidade")
      .eq("Posição", "Chão").eq("Código", skuCode)
      .order("id", { ascending: true }).limit(1);
    if (fFetchErr) throw fFetchErr;
    if (floorData && floorData.length > 0) {
      const rec = floorData[0];
      const rem = (Number(rec.Quantidade) || 0) - qty;
      if (rem <= 0) {
        const { error: delErr } = await supabase.from("mapeamento").delete().eq("id", rec.id);
        if (delErr) throw delErr;
      } else {
        const { error: updErr } = await supabase.from("mapeamento").update({ "Quantidade": rem }).eq("id", rec.id);
        if (updErr) throw updErr;
      }
    }
  }

  private async returnToFloor(skuCode: string, qty: number): Promise<void> {
    if (!skuCode || qty <= 0) return;
    const { error: insErr } = await supabase.from("mapeamento").insert({
      "Posição": "Chão", "Código": skuCode, "Quantidade": qty,
      "Nível": 0, "Profundidade": 1, "Id Palete": null,
    });
    if (insErr) throw insErr;
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  private async logToAuditTable(
    item: SyncQueueItem,
    status: "synced" | "error" = "synced",
    errorMessage?: string
  ): Promise<void> {
    try {
      const audit = item.audit || {};
      const changes = item.changes || {};
      const logEntry: Record<string, any> = {
        tipo_operacao: item.type,
        tabela: item.table,
        record_id: item.recordId ? String(item.recordId) : null,
        campo: item.field || null,
        delta: item.delta ?? null,
        sku: audit.sku || changes["Código"] || null,
        posicao: audit.posicao || changes["Posição"] || null,
        nivel: audit.nivel ?? changes["Nível"] ?? null,
        profundidade: audit.profundidade ?? changes["Profundidade"] ?? null,
        quantidade_anterior: item.original?.["Quantidade"] ?? audit.quantidade_anterior ?? null,
        quantidade_nova: changes["Quantidade"] ?? audit.quantidade ?? null,
        payload_json: Object.keys(changes).length > 0 ? changes : null,
        audit_json: Object.keys(audit).length > 0 ? audit : null,
        criado_em: item.createdAt,
        sincronizado_em: new Date().toISOString(),
        status: errorMessage ? "error" : status,
        error_message: errorMessage || null,
      };
      await supabase.from("offline_sync_log").insert(logEntry);
    } catch (logErr) {
      console.warn("[SyncManager] Falha ao registrar em offline_sync_log:", logErr);
    }
  }

  // ── Main processor ────────────────────────────────────────────────────────

  private async processItem(item: SyncQueueItem): Promise<void> {
    const { table, type, recordId, field, delta, changes } = item;

    const ALLOWED_MAP_COLUMNS = [
      "Posição","Id Palete","Código","Quantidade","Nível","Profundidade",
      "Parte Tombada","Parte Molhada","Observação","Última Alteração",
    ];

    const sanitizeMapPayload = (payload: Record<string, any>) => {
      const clean: Record<string, any> = {};
      ALLOWED_MAP_COLUMNS.forEach((col) => { if (payload[col] !== undefined) clean[col] = payload[col]; });
      if (!clean["Código"] && (payload.sku || payload.produto)) clean["Código"] = payload.sku || payload.produto;
      if (!clean["Posição"] && (payload.posicao || payload.targetPosition)) clean["Posição"] = payload.posicao || payload.targetPosition;
      if (clean["Quantidade"] === undefined && (payload.quantidade !== undefined || payload.quantidade_total !== undefined)) {
        clean["Quantidade"] = payload.quantidade !== undefined ? payload.quantidade : payload.quantidade_total;
      }
      return clean;
    };

    if (type === "QUANTITY_DELTA" && recordId && field && delta !== undefined) {
      const { data: liveData, error: fetchErr } = await supabase
        .from(table).select("*").eq("id", recordId).maybeSingle();
      if (fetchErr) throw fetchErr;
      if (liveData) {
        const currentLiveQty = Number(liveData[field]) || 0;
        const newCalculatedQty = Math.max(0, currentLiveQty + delta);
        const { error: updErr } = await supabase.from(table).update({ [field]: newCalculatedQty }).eq("id", recordId);
        if (updErr) throw updErr;

        // Business rule: adjust Chão stock
        if (table === "mapeamento" && liveData["Posição"] !== "Chão" && liveData["Posição"] !== "Retrabalho") {
          const skuCode = liveData["Código"] || changes?.["Código"] || item.audit?.sku;
          if (skuCode) {
            if (delta < 0) {
              await this.returnToFloor(skuCode, Math.abs(delta));
            } else if (delta > 0) {
              await this.consumeFromFloor(skuCode, delta);
            }
          }
        }
      }
      await this.logToAuditTable(item, "synced");

    } else if (type === "UPDATE_FIELD" && recordId && changes) {
      const payloadToUpdate = table === "mapeamento" ? sanitizeMapPayload(changes) : changes;
      const { error: updErr } = await supabase.from(table).update(payloadToUpdate).eq("id", recordId);
      if (updErr) throw updErr;
      await this.logToAuditTable(item, "synced");

    } else if (type === "ADD" && changes) {
      const rawPayload = table === "mapeamento" ? sanitizeMapPayload(changes) : changes;
      const cleanPayload = { ...rawPayload };
      delete cleanPayload.id;
      const { error: insErr } = await supabase.from(table).insert(cleanPayload);
      if (insErr) throw insErr;

      // Business rule: consume from Chão when adding to a real position
      if (table === "mapeamento") {
        const targetPos = cleanPayload["Posição"];
        if (targetPos && targetPos !== "Chão" && targetPos !== "Retrabalho") {
          const skuCode = cleanPayload["Código"];
          const qty = Number(cleanPayload["Quantidade"]) || 0;
          if (skuCode && qty > 0) await this.consumeFromFloor(skuCode, qty);
        }
      }
      await this.logToAuditTable(item, "synced");

    } else if (type === "DELETE" && recordId) {
      const { error: delErr } = await supabase.from(table).delete().eq("id", recordId);
      if (delErr) throw delErr;

      if (changes && (changes.targetPosition || changes["Posição"])) {
        const targetPos = changes.targetPosition || changes["Posição"];
        const skuCode = changes["Código"] || changes.sku || changes.produto;
        const qtyVal = changes["Quantidade"] || changes.quantidade || changes.quantidade_total || 0;
        const { error: insErr } = await supabase.from(table).insert({
          "Posição": targetPos, "Código": skuCode, "Quantidade": qtyVal,
          "Nível": 0, "Profundidade": 1,
          "Parte Tombada": changes["Parte Tombada"] || 0,
          "Parte Molhada": changes["Parte Molhada"] || 0,
          "Id Palete": null,
        });
        if (insErr) throw insErr;
      }
      await this.logToAuditTable(item, "synced");
    }
  }

  public async checkAndSync() {
    const isOnline = await this.checkRealConnection();
    if (isOnline) {
      const queue = await getSyncQueue();
      if (queue.length > 0) await this.syncPendingQueue();
    } else {
      this.currentStatus = "offline";
      await this.notifyListeners();
    }
  }
}

export const syncManager = new SyncManager();
