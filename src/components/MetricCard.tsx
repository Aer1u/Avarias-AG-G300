"use client"

import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    description?: string
    className?: string
    delay?: number
    hoverContent?: React.ReactNode
}

export function MetricCard({
    title,
    value,
    icon: Icon,
    description,
    className,
    delay = 0,
    hoverContent
}: MetricCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={cn(
                "group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md",
                className
            )}
        >
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {title}
                    </p>
                    <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
                        {value}
                    </h3>
                    {description && (
                        <p className="text-sm font-medium text-slate-500">{description}</p>
                    )}
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                    <Icon size={24} />
                </div>
            </div>

            {/* Hover Content - Elegant Speech Bubble BELOW Card */}
            {hoverContent && (
                <div className="absolute inset-x-0 top-full z-20 translate-y-2 opacity-0 transition-all duration-300 pointer-events-none group-hover:translate-y-4 group-hover:opacity-100 px-4">
                    <div className="relative rounded-2xl bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-md border border-white/10">
                        {hoverContent}
                        {/* Speech Bubble Arrow - Pointing UP */}
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 rotate-45 border-l border-t border-white/10" />
                    </div>
                </div>
            )}

            {/* Decorative gradient background */}
            <div className="absolute -bottom-1 -right-1 h-24 w-24 translate-x-12 translate-y-12 rounded-full bg-blue-500/5 blur-3xl transition-opacity group-hover:opacity-0" />
        </motion.div>
    )
}
