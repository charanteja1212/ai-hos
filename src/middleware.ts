import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Role → allowed route prefixes
const roleRoutes: Record<string, string[]> = {
  SUPER_ADMIN: ["/platform", "/admin", "/reception", "/doctor", "/pharmacy", "/lab"],
  CLIENT_ADMIN: ["/admin", "/reception", "/doctor", "/pharmacy", "/lab"],
  BRANCH_ADMIN: ["/admin", "/reception", "/doctor", "/pharmacy", "/lab"],
  ADMIN: ["/admin", "/reception", "/doctor", "/pharmacy", "/lab"],
  DOCTOR: ["/doctor"],
  RECEPTION: ["/reception"],
  LAB_TECH: ["/lab"],
  PHARMACIST: ["/pharmacy"],
  PATIENT: ["/patient"],
}

const defaultRoutes: Record<string, string> = {
  SUPER_ADMIN: "/platform",
  CLIENT_ADMIN: "/admin",
  BRANCH_ADMIN: "/admin",
  ADMIN: "/admin",
  DOCTOR: "/doctor",
  RECEPTION: "/reception",
  LAB_TECH: "/lab",
  PHARMACIST: "/pharmacy",
  PATIENT: "/patient",
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Public routes — skip auth check
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/patient-login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/unauthorized") ||
    pathname.startsWith("/queue/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  const user = req.auth?.user as { role?: string } | undefined

  // Not authenticated → redirect to appropriate login
  if (!user?.role) {
    const loginPath = pathname.startsWith("/patient") ? "/patient-login" : "/login"
    const loginUrl = new URL(loginPath, req.nextUrl.origin)
    return NextResponse.redirect(loginUrl)
  }

  // Root path → redirect to role default page
  if (pathname === "/") {
    const dest = defaultRoutes[user.role] || "/reception"
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin))
  }

  // Check role-based access
  const allowed = roleRoutes[user.role] || []
  const hasAccess = allowed.some((prefix) => pathname.startsWith(prefix))

  if (!hasAccess) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
