import { Skeleton } from "@/components/ui/skeleton"

export default function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md space-y-4 px-4">
        <Skeleton className="h-10 w-48 mx-auto" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
