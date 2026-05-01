"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Column {
    header: string
    accessor: string
    render?: (value: any, row: any) => React.ReactNode
}

interface WarehouseTableProps {
    columns: Column[]
    data: any[]
    className?: string
    delay?: number
    onRowClick?: (row: any) => void
    sortConfig?: { key: string; direction: "asc" | "desc" }
    onSort?: (key: string) => void
    selectable?: boolean
    selectedIds?: Set<string>
    onSelectionChange?: (ids: Set<string>) => void
    idAccessor?: string
}

export function WarehouseTable({
    columns,
    data,
    className,
    delay = 0,
    onRowClick,
    sortConfig,
    onSort,
    selectable = false,
    selectedIds = new Set(),
    onSelectionChange,
    idAccessor = "id",
}: WarehouseTableProps) {
    const handleSelectAll = () => {
        if (!onSelectionChange) return;
        const pageIds = new Set(data.map(row => row[idAccessor]));
        const allSelected = Array.from(pageIds).every(id => selectedIds.has(id));
        
        const newSelected = new Set(selectedIds);
        if (allSelected) {
            pageIds.forEach(id => newSelected.delete(id));
        } else {
            pageIds.forEach(id => newSelected.add(id));
        }
        onSelectionChange(newSelected);
    };

    const handleSelectRow = (id: string, event: React.MouseEvent) => {
        event.stopPropagation();
        if (!onSelectionChange) return;
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        onSelectionChange(newSelected);
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={cn(
                "overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors",
                className
            )}
        >
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            {selectable && (
                                <th className="px-6 py-4 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={data.length > 0 && data.every(row => selectedIds.has(row[idAccessor]))}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                            )}
                            {columns.map((col, i) => (
                                <th
                                    key={i}
                                    className={cn(
                                        "px-6 py-4 transition-colors",
                                        onSort && "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                    onClick={() => onSort?.(col.accessor)}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.header}
                                        {sortConfig?.key === col.accessor && (
                                            <span className="text-blue-500">
                                                {sortConfig.direction === "asc" ? "↑" : "↓"}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {data.map((row, i) => (
                            <tr
                                key={i}
                                onClick={(e) => {
                                    if (selectable && !onRowClick) {
                                        handleSelectRow(row[idAccessor], e);
                                    } else {
                                        onRowClick?.(row);
                                    }
                                }}
                                className={cn(
                                    "group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                                    (onRowClick || selectable) && "cursor-pointer active:bg-slate-100/50 dark:active:bg-slate-800/50",
                                    selectable && selectedIds.has(row[idAccessor]) && "bg-blue-50/40 dark:bg-blue-900/10"
                                )}
                            >
                                {selectable && (
                                    <td className="px-6 py-4 w-12 text-center" onClick={(e) => handleSelectRow(row[idAccessor], e)}>
                                        <input 
                                            type="checkbox" 
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectedIds.has(row[idAccessor])}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleSelectRow(row[idAccessor], e as any);
                                            }}
                                        />
                                    </td>
                                )}
                                {columns.map((col, j) => (
                                    <td key={j} className="px-6 py-4 align-middle">
                                        {col.render ? col.render(row[col.accessor], row) : row[col.accessor]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <p className="text-sm font-bold uppercase tracking-widest">Nenhum registro encontrado</p>
                </div>
            )}
        </motion.div>
    )
}
