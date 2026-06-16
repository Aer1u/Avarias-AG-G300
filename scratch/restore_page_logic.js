const fs = require('fs');
const path = 'c:/Users/Pichau/OneDrive/documentos/big/Avarias-AG-G300-main (14)/Avarias-AG-G300-main/src/app/page.tsx';

let content = fs.readFileSync(path, 'utf8');

const fullFunctionCode = `  const calculateStatsFromData = (allData: any[], movimentos: any[] = [], period: "hoje" | "semana" | "mensal" | "all" = "all", skuLookup?: Map<string, any>) => {
    // 1. Basic stats based on the unified "allData" array
    const totalPieces = allData.reduce((sum, item) => sum + (Number(item.quantidade_total) || 0), 0);
    const totalPallets = allData.reduce((sum, item) => sum + (item.paletes || 0), 0);
    const totalCapacity = allData.reduce((sum, item) => sum + (Number(item.capacidade) || 0), 0);

    // 2. Date calculations and movement statistics
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split('T')[0];
    const sunday = new Date(todayDate);
    const day = todayDate.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const firstOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    const systemBySku = new Map();
    let global_entries = 0;
    let global_exits = 0;
    let period_entries = 0;
    let period_exits = 0;

    const allFormattedMovements = movimentos.map(m => {
      const sku = String(m['Produto'] || m['Código'] || m['Codigo'] || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
      const ent = Number(m['Entrada']) || 0;
      const sai = Number(m['Saída']) || Number(m['Saida']) || 0;
      const data = m['Data'] || m['data'] || '';

      // System Total by SKU - Movement Based Source of Truth
      if (sku && sku !== "-" && sku !== "NAN") {
        systemBySku.set(sku, (systemBySku.get(sku) || 0) + (ent - sai));
      }

      global_entries += ent;
      global_exits += sai;

      // Period Filter
      let isInPeriod = true;
      if (data) {
        const d = new Date(data);
        if (period === "hoje") isInPeriod = d.toISOString().split('T')[0] === todayStr;
        else if (period === "semana") isInPeriod = d >= monday;
        else if (period === "mensal") isInPeriod = d >= firstOfMonth;
      }
      
      if (isInPeriod) {
        period_entries += ent;
        period_exits += sai;
      }

      const lookup = skuLookup?.get(sku);
      return {
        id: m.id || Math.random(),
        produto: sku,
        descricao: lookup?.descricao || 'Produto não cadastrado',
        quantidade: ent > 0 ? ent : -sai,
        data: data,
        tipo: ent > 0 ? 'entrada' : 'saída'
      };
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const formattedMovements = allFormattedMovements.slice(0, 10);

    // 3. Group Mapped Drive-In vs Chão quantities by SKU
    const mappedDriveInBySku = new Map();
    const chaoBySku = new Map();
    const skuMap = new Map();
    const frequencyMap: Record<string, number> = {};
    const molhFrequencyMap: Record<string, number> = {};
    
    allData.forEach(item => {
      const sku = String(item.produto || "").trim().toUpperCase()
        .normalize("NFD").replace(/[\\\\u0300-\\\\u036f]/g, "");
      if (!sku || sku === "-" || sku === "nan") return;
      
      const total = Number(item.quantidade_total) || 0;
      skuMap.set(sku, (skuMap.get(sku) || 0) + total);
      frequencyMap[sku] = (frequencyMap[sku] || 0) + 1;
      if (Number(item.qtd_molhado) > 0) molhFrequencyMap[sku] = (molhFrequencyMap[sku] || 0) + 1;

      if (item.is_unallocated_source) {
        chaoBySku.set(sku, (chaoBySku.get(sku) || 0) + total);
      } else {
        mappedDriveInBySku.set(sku, (mappedDriveInBySku.get(sku) || 0) + total);
      }
    });

    // 4. Compute Final Availability (Rule: Max(InChao, TotalRegistered - MappedDriveIn))
    const allSkus = new Set([...systemBySku.keys(), ...chaoBySku.keys(), ...mappedDriveInBySku.keys()]);
    const divergences = Array.from(allSkus).map(sku => {
      const systemTotal = systemBySku.get(sku) || 0;
      const inChao = chaoBySku.get(sku) || 0;
      const mappedDriveIn = mappedDriveInBySku.get(sku) || 0;
      
      const totalAvailable = Math.max(inChao, systemTotal - mappedDriveIn);
      
      return {
        produto: sku,
        available: totalAvailable
      };
    }).filter(d => d.available > 0);

    return {
      total_quantity: totalPieces,
      total_pallets: totalPallets,
      total_skus: skuMap.size,
      movement_pieces: totalPieces, 
      today_net: period_entries - period_exits,
      total_entries: global_entries,
      total_exits: global_exits,
      period_entries,
      period_exits,
      total_capacity: totalCapacity, 
      qtd_molhado: allData.reduce((sum, item) => sum + (Number(item.qtd_molhado) || 0), 0),
      qtd_tombada: allData.reduce((sum, item) => sum + (Number(item.qtd_tombada) || 0), 0),
      frequency_by_product: frequencyMap,
      molh_frequency_by_product: molhFrequencyMap,
      mixed_pallets_consolidated: allData.filter(i => i.paletes === 0).length,
      latest_movements: allFormattedMovements,
      top_moved: formattedMovements,
      divergences: divergences
    };
  };`;

// Replace the existing broken function
content = content.replace(
  /const calculateStatsFromData = \([\s\S]+?\};[\r\n\s]+const fetchAllSupabaseData/,
  fullFunctionCode + '\\n\\n  const fetchAllSupabaseData'
);

// Cleanup fetchData calls (remove a501Raw argument)
content = content.replace(
  /const (hoje|semana|mensal)Stats = calculateStatsFromData\(combinedData, historicoRaw, ".*", skuLookup, a501Raw\);/g,
  (match, p1) => {
    return match.replace(', a501Raw', '');
  }
);

fs.writeFileSync(path, content);
console.log('Success: page.tsx restored and corrected.');
