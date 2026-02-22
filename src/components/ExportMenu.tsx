"use client"

import { useState, useRef, useEffect } from "react"
import {
  Download,
  ChevronDown,
  FileSpreadsheet,
  Printer,
  MoreHorizontal,
  FileText
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"

interface ExportMenuProps {
  data: any[]
  variant?: "default" | "mini"
  type?: "product" | "position"
  label?: string
}

export function ExportMenu({ data, variant = "default", type = "product", label }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // EXCEL EXPORT FUNCTIONS
  const exportToExcel = (exportData: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Relatório")
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`)
    setIsOpen(false)
  }

  const exportConsolidated = () => {
    const mapped = data.map(item => ({
      "Código": item.produto || item.sku || "Não Identificado",
      "Posição": item.posicao || "S/P",
      "Nível": item.nivel || "-",
      "Profundidade": item.profundidade || "-",
      "Qtd": item.quantidade_total || item.quantidade || 0,
      "Molhado": item.qtd_molhado || 0,
      "Tombado": item.qtd_tombada || 0
    }))
    exportToExcel(mapped, "Consolidado_Avarias_G300")
  }

  const exportPositionItems = () => {
    const mapped = data.map(item => ({
      "Código": item.produto || item.sku || "Não Identificado",
      "Posição": label || item.posicao || "S/P",
      "Nível": item.nivel || "-",
      "Profundidade": item.profundidade || "-",
      "Qtd": item.quantidade || 0,
      "Molhado": item.qtd_molhado || 0,
      "Tombado": item.qtd_tombada || 0
    }))
    exportToExcel(mapped, `Relacao_Posicao_${label || 'Desconhecida'}`)
  }

  // PRINT FUNCTIONS
  const handlePrint = (printType: 'audit' | 'label' | 'relation', selectedItem?: any) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let content = ''

    if (printType === 'audit') {
      content = `
        <html>
          <head>
            <title>Ficha de Auditoria - Bate Físico</title>
            <style>
              @page { size: portrait; margin: 1cm; }
              body { font-family: sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f0f0f0; text-transform: uppercase; font-size: 10px; }
              h1 { font-size: 18px; text-align: center; margin: 0; }
              .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
              .info { font-size: 10px; margin-top: 5px; color: #666; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Ficha de Auditoria (Bate-Físico) - G300</h1>
              <p class="info">Relatório de Materiais Avariados • Gerado em ${new Date().toLocaleString()}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Posição</th>
                  <th>Nível</th>
                  <th>Qtd Sist.</th>
                  <th>Qtd Física</th>
                </tr>
              </thead>
              <tbody>
                ${data.slice(0, 500).map(item => `
                  <tr>
                    <td>${item.produto || item.sku || "-"}</td>
                    <td>${item.posicao || "-"}</td>
                    <td>${item.nivel || "-"}</td>
                    <td>${item.quantidade_total || item.quantidade || 0}</td>
                    <td></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `
    } else if (printType === 'relation') {
      content = `
        <html>
          <head>
            <title>Relação de Itens da Posição ${label}</title>
            <style>
              @page { size: portrait; margin: 1cm; }
              body { font-family: sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #000; padding: 12px; text-align: left; }
              th { background-color: #f8fafc; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #64748b; }
              td { font-size: 14px; font-weight: 700; color: #1e293b; }
              h1 { font-size: 28px; font-weight: 900; margin: 0; }
              .header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #0f172a; padding-bottom: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1>${label}</h1>
              </div>
              <p style="font-size: 10px; font-weight: 700; color: #94a3b8; margin: 0;">${new Date().toLocaleString()}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nível</th>
                  <th>Prof.</th>
                  <th>Qtd</th>
                  <th>Avaria</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(item => `
                  <tr>
                    <td>${item.produto || item.sku || "-"}</td>
                    <td>${item.nivel || "-"}</td>
                    <td>${item.profundidade || "-"}</td>
                    <td>${item.quantidade || 0}</td>
                    <td>${item.qtd_molhado > 0 ? "Molhado" : (item.qtd_tombada > 0 ? "Tombada" : "Geral")}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `
    } else {
      // LANDSCAPE A4 WARNING (AVISO)
      const item = selectedItem || data[0]
      const isPositionLabel = type === 'position'

      content = `
        <html>
          <head>
            <title>Aviso do Drive - G300</title>
            <style>
              @page { size: A4 landscape; margin: 10mm; }
              body { 
                font-family: sans-serif; 
                margin: 0; 
                padding: 0;
                display: flex; 
                align-items: center; 
                justify-content: center; 
                height: 100vh;
                width: 100vw;
                background: #fff;
              }
              .container { 
                width: 100%; 
                height: 100%; 
                border: 15px solid #000; 
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
                overflow: hidden;
              }
              .alert-header { 
                font-size: 60px; 
                font-weight: 900; 
                background: #000; 
                color: #fff; 
                width: 100%;
                padding: 15px 0;
                text-transform: uppercase; 
                letter-spacing: 20px;
                text-align: center;
              }
              .main-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px 40px;
                gap: 5px;
              }
              .main-text { 
                font-size: 110px; 
                font-weight: 940; 
                margin: 0; 
                line-height: 0.9; 
                letter-spacing: -2px;
                color: #000;
                word-break: break-all;
                text-align: center;
              }
              .sub-text {
                font-size: 40px;
                font-weight: 900;
                color: #000;
                text-transform: uppercase;
                margin-top: 10px;
                background: #f1f5f9;
                padding: 5px 20px;
                border-radius: 10px;
              }
              .footer-details { 
                display: flex; 
                justify-content: space-between; 
                width: 100%; 
                border-top: 10px solid #000; 
                padding: 20px 40px;
                box-sizing: border-box;
                align-items: flex-end;
              }
              .footer-left {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
              }
              .footer-pos { font-size: 70px; font-weight: 900; margin: 0; line-height: 1; }
              .footer-qty { font-size: 100px; font-weight: 900; margin: 0; line-height: 1; }
              .damage-tag {
                font-size: 35px;
                font-weight: 900;
                border: 6px solid #000;
                padding: 5px 15px;
                text-transform: uppercase;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="alert-header">AVARIA</div>
              
              <div class="main-content">
                <p class="main-text">${isPositionLabel ? (label || "S-P") : (item?.produto || item?.sku || "N/A")}</p>
                ${isPositionLabel ? `<div class="sub-text">PRODUTO: ${item?.produto || item?.sku || "N/A"}</div>` : ''}
              </div>

              <div class="footer-details">
                <div class="footer-left">
                  <div class="damage-tag">${(item?.qtd_molhado > 0) ? "MOLHADO" : (item?.qtd_tombada > 0 ? "TOMBADO" : "GERAL")}</div>
                  <div class="footer-pos">${isPositionLabel ? "" : (item?.posicao || "S-P")}</div>
                </div>
                <div class="footer-qty">${item?.quantidade_total || item?.quantidade || 0} UN</div>
              </div>
            </div>
          </body>
        </html>
      `
    }

    printWindow.document.write(content)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
    setIsOpen(false)
  }

  // Handle SKU label printing with position choice
  const handleSKULabel = () => {
    if (data.length > 1) {
      // If multiple positions for this SKU, we need the user to pick one
      // Since we are in a simple web app, let's just use the first for now OR
      // we could show another state in our menu.
      // But user asked "pedi para a pessoa escolher a posição".
      // In a real app we'd need a modal, but let's try to do it in the dropdown.
      setShowingPositions(true)
    } else {
      handlePrint('label')
    }
  }

  const [showingPositions, setShowingPositions] = useState(false)

  if (variant === "mini") {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => {
            setIsOpen(!isOpen)
            setShowingPositions(false)
          }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-100"
          title="Mais opções"
        >
          <MoreHorizontal size={20} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-3xl bg-white p-2 shadow-2xl shadow-slate-200 border border-slate-100 z-[110]"
            >
              {!showingPositions ? (
                <>
                  <MenuButton
                    icon={FileSpreadsheet}
                    label={type === "product" ? "Gerar Excel (SKU)" : "Gerar Excel (Posição)"}
                    onClick={type === "product" ? exportConsolidated : exportPositionItems}
                  />
                  {type === "position" && data.length === 1 && (
                    <MenuButton
                      icon={Printer}
                      label="Aviso do Drive (A4 Paisagem)"
                      onClick={() => handlePrint('label')}
                    />
                  )}
                  {type === "product" && (
                    <MenuButton
                      icon={Printer}
                      label="Imprimir Etiqueta"
                      onClick={handleSKULabel}
                    />
                  )}
                  <MenuButton
                    icon={FileText}
                    label={type === "product" ? "Imprimir Relação" : "Relação da Posição (Lista)"}
                    onClick={() => handlePrint('relation')}
                  />
                </>
              ) : (
                <div className="p-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2 px-1 text-center">Escolha a Posição</p>
                  <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                    {data.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePrint('label', p)}
                        className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all flex justify-between items-center"
                      >
                        <span>{p.posicao}</span>
                        <span className="text-[9px] text-slate-400">{p.quantidade} un</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowingPositions(false)}
                    className="w-full mt-2 py-2 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800"
      >
        <Download size={16} />
        {label || "Exportar"}
        <ChevronDown size={14} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-3xl bg-white p-2 shadow-2xl shadow-slate-200 border border-slate-100 z-[60]"
          >
            <div className="px-3 py-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Planilhas (Excel)</p>
              <MenuButton
                icon={FileSpreadsheet}
                label="Consolidado por Código"
                onClick={exportConsolidated}
              />
            </div>

            <div className="my-2 border-t border-slate-50" />

            <div className="px-3 py-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Impressão (PDF)</p>
              <MenuButton
                icon={Printer}
                label="Ficha p/ Conferência Física"
                onClick={() => handlePrint('audit')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuButton({ icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-blue-50 group"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-blue-600 group-hover:shadow-sm transition-all border border-transparent group-hover:border-blue-100">
        <Icon size={16} />
      </div>
      <span className="text-[11px] font-black uppercase tracking-tight text-slate-600 group-hover:text-slate-900 transition-colors">
        {label}
      </span>
    </button>
  )
}
