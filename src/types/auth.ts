export type UserRole =
  | "SUPER_ADMIN"
  | "CLIENT_ADMIN"
  | "BRANCH_ADMIN"
  | "ADMIN"          // backward compat alias for BRANCH_ADMIN
  | "DOCTOR"
  | "RECEPTION"
  | "LAB_TECH"
  | "PHARMACIST"
  | "PATIENT"

export interface SessionUser {
  id: string
  name: string
  role: UserRole
  tenantId: string        // = branch ID (backward compat)
  hospitalName: string    // branch name
  clientId?: string       // parent client ID
  clientName?: string     // parent client name
  doctorId?: string       // Only for DOCTOR role
  specialty?: string      // Only for DOCTOR role
  email?: string          // Set when user has password auth configured
  patientPhone?: string   // Only for PATIENT role
}

export const PLATFORM_ROLES: UserRole[] = ["SUPER_ADMIN"]
export const CLIENT_ROLES: UserRole[] = ["CLIENT_ADMIN"]
export const BRANCH_ROLES: UserRole[] = ["BRANCH_ADMIN", "ADMIN", "DOCTOR", "RECEPTION", "LAB_TECH", "PHARMACIST"]

/** Extended session type with Supabase JWT for browser RLS */
export interface ExtendedSession {
  user: SessionUser
  supabaseAccessToken?: string
  expires: string
}
