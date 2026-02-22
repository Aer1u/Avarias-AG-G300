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
}

export function WarehouseTable({
    columns,
    data,
    className,
    delay = 0,
    onRowClick,
    sortConfig,
    onSort,
}: WarehouseTableProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={cn(
                "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
                className
            )}
        >
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <tr>
                            {columns.map((col, i) => (
                                <th
                                    key={i}
                                    className={cn(
                                        "px-6 py-4",
                                        onSort && "cursor-pointer hover:bg-slate-100 transition-colors"
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
                    <tbody className="divide-y divide-slate-100">
                        {data.map((row, i) => (
                            <tr
                                key={i}
                                onClick={() => onRowClick?.(row)}
                                className={cn(
                                    "group transition-colors hover:bg-slate-50/50",
                                    onRowClick && "cursor-pointer active:bg-slate-100/50"
                                )}
                            >
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
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <p>Nenhum registro encontrado</p>
                </div>
            )}
        </motion.div>
    )
}
