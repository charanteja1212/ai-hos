import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Stat cards — staggered reveal matching new StatCard shape */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 border-l-[3px] border-l-muted p-5 animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-20 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Table/content area */}
      <div
        className="rounded-xl border border-border/60 p-4 space-y-3 animate-fade-in"
        style={{ animationDelay: "350ms" }}
      >
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
