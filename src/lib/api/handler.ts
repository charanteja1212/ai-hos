import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createRouteLogger } from "@/lib/logger"
import { apiUnauthorized, apiForbidden, apiError } from "./response"

interface HandlerContext {
  user: SessionUser
  req: NextRequest
}

interface HandlerOptions {
  /** Route name for logging (e.g., "/api/booking") */
  route: string
  /** Required roles — empty means all authenticated users */
  roles?: string[]
}

/**
 * Wraps an API route handler with auth, role checks, and error handling.
 * Eliminates the repetitive try/catch + auth + role check boilerplate.
 *
 * Usage:
 *   export const POST = withAuth(
 *     { route: "/api/booking", roles: ["RECEPTION", "ADMIN"] },
 *     async ({ user, req }) => {
 *       const body = await req.json()
 *       // ... business logic
 *       return apiSuccess({ booking })
 *     }
 *   )
 */
export function withAuth(
  options: HandlerOptions,
  handler: (ctx: HandlerContext) => Promise<Response>
) {
  const log = createRouteLogger(options.route)

  return async (req: NextRequest) => {
    try {
      // Auth check
      const session = await auth()
      const user = session?.user as SessionUser | undefined

      if (!user) {
        return apiUnauthorized()
      }

      // Role check
      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(user.role)) {
          log.warn({ role: user.role, required: options.roles }, "Insufficient role")
          return apiForbidden("Insufficient permissions")
        }
      }

      // Execute handler
      return await handler({ user, req })
    } catch (err: unknown) {
      log.error({ err }, `Unhandled error in ${options.route}`)
      return apiError("Internal server error", 500)
    }
  }
}
