import { Skeleton } from "@/components/ui/skeleton"

export default function PlatformLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Stat cards — staggered */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
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

      {/* Content skeleton */}
      <div
        className="rounded-xl border border-border/60 p-6 space-y-4 animate-fade-in"
        style={{ animationDelay: "280ms" }}
      >
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  )
}
