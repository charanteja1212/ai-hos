"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const ChartFallback = () => <Skeleton className="w-full h-[260px] rounded-xl" />

export const LazyLineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false, loading: ChartFallback }
)

export const LazyBarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false, loading: ChartFallback }
)

export const LazyPieChart = dynamic(
  () => import("recharts").then((mod) => mod.PieChart),
  { ssr: false, loading: ChartFallback }
)

// Re-export non-chart components that are always needed with charts
// These are lightweight and don't need lazy loading themselves
export {
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Pie,
  Cell,
} from "recharts"
