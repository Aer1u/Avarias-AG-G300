# Guia de Referência de Design: Tabela do Cronograma de Embalagens

Este documento contém a especificação técnica completa, tokens de design (cores, fontes, espaçamentos, **largura de página**) e o código React/Tailwind CSS idêntico à tabela da aba **Cronograma de Embalagens** do sistema **Avarias-AG-G300**.

---

## 📐 1. Largura da Página & Container (Crucial)

Para que a tabela do Cronograma fique **exatamente com a mesma largura da Dashboard e do Painel Comparativo**, o elemento pai/wrapper da página deve usar as classes Tailwind:

```html
<!-- Wrapper da Página (Mesma largura da Dashboard) -->
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
  <!-- Tabela do Cronograma aqui dentro -->
</div>
```

* **Largura Máxima:** `max-w-7xl` (`80rem` = `1280px`)
* **Centralização:** `mx-auto`
* **Preenchimento Lateral:** `px-4` a `px-6`
* **Largura Responsiva:** `w-full`

---

## 🎨 2. Spec e Tokens de Design

### Paleta de Cores & Fundo
* **Fundo do Container Principal:** `bg-[#0B1120]` (Azul escuro enterprise / Slate profundo)
* **Borda do Container:** `border border-white/[0.06]`
* **Linhas de Separação:**
  * Divisória de Grupos: `border-b border-white/[0.04]`
  * Divisória de Linhas Internas: `border-b border-white/[0.03]`
* **Cabeçalhos de Tabela:** `bg-white/[0.01] border-b border-white/[0.04]`
* **Efeito Hover de Linhas:** `hover:bg-white/[0.015]` ou `hover:bg-white/[0.02]` (suave e discreto)

### Fontes & Tipografia
* **Fonte Principal (Textos & Rótulos):** `font-sans` (`Inter`, `-apple-system`, `sans-serif`)
* **Fonte Númerica & Códigos:** `font-mono` (`Geist Mono`, `monospace`)
* **Tamanhos e Pesos de Texto:**
  * **Títulos de Colunas:** `text-[9px]` ou `text-[9.5px] font-semibold text-slate-300 uppercase tracking-widest`
  * **Texto do Resumo:** `text-[11px] font-medium text-slate-300`
  * **Valores das Células:** `text-[10.5px] text-slate-400`
  * **Badges:** `text-[9.5px]` ou `text-[10px] font-medium`

### Badges e Indicadores de Status
* **Status Concluído (Geral / Item):**
  * Classe: `text-emerald-400 bg-emerald-500/10`
  * Rótulo: `✓ Concluído` ou `FINALIZADO`
* **Status Em Andamento:**
  * Classe: `text-blue-400 bg-blue-500/10`
  * Rótulo: `EM ANDAMENTO`
* **Status Pendente:**
  * Classe: `text-amber-400 bg-amber-500/10`
  * Rótulo: `Pendente`
* **Status BA (Baixado):**
  * Marcou BA (`isBa = true`): `bg-emerald-500/10 border border-emerald-500/20 text-emerald-400` (`✓ BA`)
  * Desmarcado (`isBa = false`): `bg-transparent border border-white/[0.06] text-slate-600` (`—`)

---

## 📐 3. Esqueleto & Grid do Layout

### Cabeçalho do Grupo (Accordion Header)
Grid de 7 colunas proporcional:
`grid grid-cols-[2fr_1.5fr_1.5fr_4fr_1fr_1fr_1fr] px-4 py-2.5`
1. **Solicitação** (Com ícone `ChevronRight` com rotação animada `transition-transform duration-150`)
2. **Data Solicitação** (`text-slate-500`)
3. **Solicitante** (`text-slate-400 truncate`)
4. **Resumo Operacional** (Qtd de itens + Responsável + Badge de Status Geral)
5. **Solicitado** (Alinhado à direita, `font-mono text-slate-400`)
6. **Enviado** (Alinhado à direita, `font-mono text-emerald-500/80`)
7. **Pendente** (Alinhado à direita, `font-mono text-amber-400`)

### Tabela Interna de Detalhes (Expanded Row)
Tabela com rolagem horizontal (`overflow-x-auto`), largura mínima de `1400px` e largura fixa de colunas:
* `Cód. Produto`: `88px`
* `Modelo`: `110px`
* `Qtd`: `52px` (Centralizado)
* `Cód. Emb.`: `120px`
* `Descrição Emb.`: `180px`
* `Tipo`: `80px`
* `Tipo Emb.`: `110px`
* `Enviado`: `68px` (Com ícone de Caminhão `Truck` quando `> 0`)
* `Pendente`: `68px` (Com ícone de Ampulheta `Hourglass` quando `!= 0`)
* `Entrega (C.)`: `100px`
* `Envio (E.)`: `100px`
* `Status`: `95px`
* `Status BA`: `95px`
* `NF`: `68px`
* `Previsão`: `80px`

---

## 💻 4. Código do Componente de Referência (React + Tailwind CSS)

```tsx
import React, { useState } from 'react';
import { ChevronRight, Truck, Hourglass, Loader2, Inbox } from 'lucide-react';

// Utilitário para unir classes condicionalmente
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// Interfaces de Dados
export interface ItemCronograma {
  id: string;
  solicitacao: string;
  data_solicitacao?: string;
  data?: string;
  solicitante?: string;
  responsabilidade?: string;
  codigo: string;
  modelo?: string;
  modelo_produto?: string;
  quantidade: number;
  codigo_embalagem?: string;
  descricao_embalagem?: string;
  tipo?: string;
  tipo_embalagem?: string;
  enviado: number;
  pendente: number;
  entrega_compras?: string;
  envio_expedicao?: string;
  status: 'FINALIZADO' | 'EM ANDAMENTO' | 'PENDENTE';
  isBa?: boolean;
  nf?: string;
  previsao_entrega?: string;
}

interface CronogramaEmbalagensProps {
  items: ItemCronograma[];
  loading?: boolean;
  onToggleBa?: (rowId: string) => void;
}

export function CronogramaEmbalagensPage({
  items,
  loading = false,
  onToggleBa,
}: CronogramaEmbalagensProps) {
  const [expandedSolicitations, setExpandedSolicitations] = useState<Set<string>>(
    new Set()
  );

  // Agrupamento por número de Solicitação
  const groups: Record<string, ItemCronograma[]> = {};
  items.forEach((item) => {
    const key = item.solicitacao || 'sem-solicitacao';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const numA = Number(a[0].replace(/\D/g, '')) || 0;
    const numB = Number(b[0].replace(/\D/g, '')) || 0;
    return numB - numA; // Ordem decrescente
  });

  return (
    /* Contêiner da Página: Garante a MESMA LARGURA DA DASHBOARD (1280px max-width) */
    <div className="w-full max-w-7xl mx-auto space-y-6 text-slate-200 font-sans">
      <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[#0B1120]">
        {/* Cabeçalho Fixo Superior */}
        <div className="grid grid-cols-[2fr_1.5fr_1.5fr_4fr_1fr_1fr_1fr] px-4 py-2 border-b border-white/[0.06] text-[9.5px] font-medium text-slate-500 uppercase tracking-widest select-none">
          <span>Solicitação</span>
          <span>Data Solicitação</span>
          <span>Solicitante</span>
          <span>Resumo Operacional</span>
          <span className="text-right">Solicitado</span>
          <span className="text-right">Enviado</span>
          <span className="text-right text-amber-500/80">Pendente</span>
        </div>

        {/* Estado de Carregamento */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="animate-spin text-blue-500 mr-2" size={18} />
            <span className="text-xs font-mono">Carregando...</span>
          </div>
        ) : sortedGroups.length === 0 ? (
          /* Estado Vazio */
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <Inbox size={24} className="mb-2" />
            <p className="text-xs font-mono">Nenhuma solicitação encontrada.</p>
          </div>
        ) : (
          /* Lista de Grupos Accordion */
          sortedGroups.map(([solKey, groupItems]) => {
            const isExpanded = expandedSolicitations.has(solKey);

            const toggle = () => {
              setExpandedSolicitations((prev) => {
                const next = new Set(prev);
                if (next.has(solKey)) next.delete(solKey);
                else next.add(solKey);
                return next;
              });
            };

            // Cálculos de totais do grupo
            let totSolic = 0;
            let totEnviado = 0;
            let totPendente = 0;

            groupItems.forEach((p) => {
              totSolic += Math.round(Number(p.quantidade) || 0);
              totEnviado += Math.round(Number(p.enviado) || 0);
              totPendente += Math.round(Number(p.pendente) || 0);
            });

            const itemWithDate = groupItems.find((x) => x.data_solicitacao || x.data);
            const dateLabel = itemWithDate?.data_solicitacao
              ? new Date(itemWithDate.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR')
              : itemWithDate?.data
              ? new Date(itemWithDate.data + 'T00:00:00').toLocaleDateString('pt-BR')
              : '—';

            const responsavel = groupItems[0]?.responsabilidade || 'Não definido';
            const isAllFinalized = groupItems.every(
              (x) => String(x.status || '').trim().toUpperCase() === 'FINALIZADO'
            );

            return (
              <div key={solKey} className="border-b border-white/[0.04] last:border-0">
                {/* Botão da Linha de Resumo */}
                <button
                  onClick={toggle}
                  className="w-full grid grid-cols-[2fr_1.5fr_1.5fr_4fr_1fr_1fr_1fr] px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left items-center cursor-pointer group"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronRight
                      size={13}
                      className={cn(
                        'text-slate-600 transition-transform duration-150 flex-shrink-0',
                        isExpanded && 'rotate-90'
                      )}
                    />
                    <span className="text-[11px] font-medium text-slate-300 tracking-wide">
                      Solicitação {solKey === 'sem-solicitacao' ? 'S/N' : solKey}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-500">{dateLabel}</span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {groupItems[0]?.solicitante || '—'}
                  </span>
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-600">
                      {groupItems.length} {groupItems.length === 1 ? 'item' : 'itens'}
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="text-slate-500">{responsavel}</span>
                    <span className="text-slate-700">·</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        isAllFinalized
                          ? 'text-emerald-400/90 bg-emerald-500/10'
                          : 'text-amber-400/90 bg-amber-500/10'
                      )}
                    >
                      {isAllFinalized ? '✓ Concluído' : 'Pendente'}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 text-right font-mono">
                    {totSolic.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[11px] text-emerald-500/80 text-right font-mono">
                    {totEnviado.toLocaleString('pt-BR')}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] text-right font-mono',
                      totPendente > 0 ? 'text-amber-400' : 'text-slate-600'
                    )}
                  >
                    {totPendente.toLocaleString('pt-BR')}
                  </span>
                </button>

                {/* Tabela Expandida de Detalhes */}
                {isExpanded && (
                  <div className="border-t border-white/[0.04] overflow-x-auto">
                    <table
                      className="w-full border-collapse text-[10.5px]"
                      style={{ minWidth: '1400px', tableLayout: 'fixed' }}
                    >
                      <colgroup>
                        <col style={{ width: '88px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '52px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '180px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '68px' }} />
                        <col style={{ width: '68px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '95px' }} />
                        <col style={{ width: '95px' }} />
                        <col style={{ width: '68px' }} />
                        <col style={{ width: '80px' }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Cód. Produto
                          </th>
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Modelo
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Qtd
                          </th>
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Cód. Emb.
                          </th>
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Descrição Emb.
                          </th>
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Tipo
                          </th>
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Tipo Emb.
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Enviado
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Pendente
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Entrega (C.)
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Envio (E.)
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Status
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Status BA
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            NF
                          </th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-semibold text-slate-300 uppercase tracking-widest">
                            Previsão
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupItems.map((row, ri) => {
                          const statusUpper = (row.status || 'PENDENTE').toUpperCase();

                          return (
                            <tr
                              key={ri}
                              className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.015] transition-colors"
                            >
                              <td className="px-3 py-1.5 overflow-hidden">
                                <span
                                  className="block truncate text-slate-400 cursor-help"
                                  title={row.modelo_produto || row.modelo || ''}
                                >
                                  {row.codigo}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 overflow-hidden">
                                <span className="block truncate text-slate-400" title={row.modelo || ''}>
                                  {row.modelo || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center text-slate-400">
                                {Number(row.quantidade || 0).toLocaleString('pt-BR')}
                              </td>
                              <td className="px-3 py-1.5 overflow-hidden">
                                <span
                                  className="block truncate text-slate-400"
                                  title={row.codigo_embalagem || ''}
                                >
                                  {row.codigo_embalagem || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 overflow-hidden">
                                <span
                                  className="block truncate text-slate-400"
                                  title={row.descricao_embalagem || ''}
                                >
                                  {row.descricao_embalagem || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 overflow-hidden">
                                <span className="block truncate text-slate-400 uppercase text-[10px]">
                                  {row.tipo || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 overflow-hidden">
                                <span className="block truncate text-slate-400 uppercase text-[10px]">
                                  {row.tipo_embalagem || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center font-mono">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1',
                                    row.enviado > 0 ? 'text-emerald-500' : 'text-slate-600'
                                  )}
                                >
                                  {row.enviado > 0 && (
                                    <Truck size={10} className="opacity-70 flex-shrink-0" />
                                  )}
                                  {Number(row.enviado || 0).toLocaleString('pt-BR')}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center font-mono">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1',
                                    row.pendente !== 0 ? 'text-amber-500' : 'text-slate-600'
                                  )}
                                >
                                  {row.pendente !== 0 && (
                                    <Hourglass size={10} className="opacity-70 flex-shrink-0" />
                                  )}
                                  {Number(row.pendente || 0).toLocaleString('pt-BR')}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center text-slate-400 text-[10px]">
                                {row.entrega_compras || 'TBC'}
                              </td>
                              <td className="px-3 py-1.5 text-center text-slate-400 text-[10px]">
                                {row.envio_expedicao || 'TBC'}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <span
                                  className={cn(
                                    'inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-medium',
                                    statusUpper === 'FINALIZADO'
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : statusUpper === 'EM ANDAMENTO'
                                      ? 'text-blue-400 bg-blue-500/10'
                                      : 'text-amber-400 bg-amber-500/10'
                                  )}
                                >
                                  {statusUpper}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  onClick={() => onToggleBa && onToggleBa(row.id)}
                                  title={
                                    row.isBa
                                      ? 'Clique para desmarcar BA'
                                      : 'Clique para marcar como chegou (BA)'
                                  }
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[9.5px] font-medium transition-all border cursor-pointer',
                                    row.isBa
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                      : 'bg-transparent border-white/[0.06] text-slate-600 hover:text-slate-400 hover:border-white/[0.12]'
                                  )}
                                >
                                  {row.isBa ? '✓ BA' : '—'}
                                </button>
                              </td>
                              <td className="px-3 py-1.5 text-center text-slate-400 text-[10px]">
                                {row.nf || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-center text-slate-400 text-[10px]">
                                {row.previsao_entrega || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```
