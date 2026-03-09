import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { UserRole, SessionUser } from "@/types/auth"

interface GuardOptions {
  allowedRoles: UserRole[]
}

interface GuardSuccess {
  user: SessionUser
  tenantId: string
  clientId: string
}

/**
 * API route auth guard — validates session + role.
 * Returns user info on success, or a NextResponse error on failure.
 */
export async function apiGuard(
  options: GuardOptions
): Promise<GuardSuccess | NextResponse> {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const user = session.user as unknown as SessionUser

  if (!options.allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    )
  }

  return {
    user,
    tenantId: user.tenantId || "",
    clientId: user.clientId || "",
  }
}

/** Type guard to check if apiGuard returned an error response */
export function isGuardError(
  result: GuardSuccess | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
