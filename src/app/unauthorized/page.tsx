import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShieldX } from "lucide-react"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-2">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm">
          You don&apos;t have permission to access this page. Please contact your administrator.
        </p>
        <Button asChild>
          <Link href="/login">Back to Login</Link>
        </Button>
      </div>
    </div>
  )
}
