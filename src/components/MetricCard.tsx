"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
    title: React.ReactNode | string
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
    const [isHovered, setIsHovered] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        setIsHovered(true)
    }

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            setIsHovered(false)
            timeoutRef.current = null
        }, 250) // Reduced to 250ms for faster disappearance
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            onPointerEnter={handleMouseEnter}
            onPointerLeave={handleMouseLeave}
            className={cn(
                "group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 shadow-sm transition-all hover:border-blue-300 dark:hover:border-blue-900/50 hover:shadow-md dark:hover:shadow-slate-950/50",
                className
            )}
        >
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {title}
                    </div>
                    <h3 className="text-xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                        {value}
                    </h3>
                    {description && (
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">{description}</p>
                    )}
                </div>
                <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    <Icon size={20} className="md:w-6 md:h-6" />
                </div>
            </div>

            {/* Hover Content - Elegant Speech Bubble BELOW Card */}
            <AnimatePresence>
                {hoverContent && isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        // Starts exactly at top-full with padding to create visual gap while bridging hover
                        className="absolute inset-x-0 top-full z-20 flex justify-center px-4 pt-2 pb-6"
                    >
                        <div className="relative rounded-[2rem] bg-white/95 dark:bg-slate-900/95 p-4 md:p-6 text-slate-900 dark:text-white shadow-2xl backdrop-blur-md border border-slate-200 dark:border-white/10 max-w-[calc(100vw-2rem)] min-w-[220px] md:min-w-[320px]">
                            {hoverContent}
                            {/* Speech Bubble Arrow - Pointing UP */}
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white dark:bg-slate-900 rotate-45 border-l border-t border-slate-200 dark:border-white/10" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Decorative gradient background */}
            <div className="absolute -bottom-1 -right-1 h-24 w-24 translate-x-12 translate-y-12 rounded-full bg-blue-500/5 blur-3xl transition-opacity group-hover:opacity-0" />
        </motion.div>
    )
}
