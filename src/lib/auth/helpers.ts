import { auth } from "@/lib/auth"
import type { SessionUser, UserRole } from "@/types/auth"
import { redirect } from "next/navigation"

export async function getSession() {
  return auth()
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user) return null
  return session.user as SessionUser
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/unauthorized")
  }

  return user
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role !== "SUPER_ADMIN") redirect("/unauthorized")
  return user
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN"
}

export function isClientAdmin(user: SessionUser): boolean {
  return user.role === "CLIENT_ADMIN" || user.role === "SUPER_ADMIN"
}

export function isBranchAdmin(user: SessionUser): boolean {
  return user.role === "BRANCH_ADMIN" || user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || user.role === "SUPER_ADMIN"
}
