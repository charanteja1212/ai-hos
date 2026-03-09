import { Skeleton } from "@/components/ui/skeleton"

export default function PlatformLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-16 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
