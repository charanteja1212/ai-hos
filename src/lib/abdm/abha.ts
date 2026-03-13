/**
 * ABHA (Ayushman Bharat Health Account) Operations
 *
 * Server-side utilities for:
 * - Generating OTP for ABHA verification
 * - Verifying ABHA number via Aadhaar/mobile OTP
 * - Fetching ABHA profile
 * - Linking/unlinking ABHA to patient records
 */

import { getEndpoints, type AbdmConfig } from "./config"

interface AbdmSession {
  accessToken: string
  expiresIn: number
  tokenType: string
}

// Get gateway session token
export async function getGatewayToken(config: AbdmConfig): Promise<AbdmSession> {
  const endpoints = getEndpoints(config.environment)

  const res = await fetch(endpoints.auth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ABDM auth failed: ${res.status} — ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.accessToken,
    expiresIn: data.expiresIn,
    tokenType: data.tokenType || "Bearer",
  }
}

// Request OTP for ABHA verification (Aadhaar or Mobile)
export async function requestAbhaOtp(
  config: AbdmConfig,
  token: string,
  params: {
    abhaNumber?: string
    abhaAddress?: string
    authMethod: "AADHAAR_OTP" | "MOBILE_OTP"
  }
): Promise<{ txnId: string; message: string }> {
  const endpoints = getEndpoints(config.environment)

  const res = await fetch(`${endpoints.abha}/profile/login/request/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      scope: ["abha-login", "abha-enrol"],
      loginHint: params.authMethod === "AADHAAR_OTP" ? "abha-number" : "mobile",
      loginId: params.abhaNumber || params.abhaAddress,
      otpSystem: params.authMethod === "AADHAAR_OTP" ? "aadhaar" : "abdm",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OTP request failed: ${res.status} — ${text}`)
  }

  const data = await res.json()
  return {
    txnId: data.txnId,
    message: data.message || "OTP sent successfully",
  }
}

// Verify OTP and get ABHA profile
export async function verifyAbhaOtp(
  config: AbdmConfig,
  token: string,
  params: { txnId: string; otp: string }
): Promise<AbhaProfile> {
  const endpoints = getEndpoints(config.environment)

  const res = await fetch(`${endpoints.abha}/profile/login/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      scope: ["abha-login", "abha-enrol"],
      authData: {
        authMethods: ["otp"],
        otp: {
          txnId: params.txnId,
          otpValue: params.otp,
        },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OTP verification failed: ${res.status} — ${text}`)
  }

  const data = await res.json()
  return {
    abhaNumber: data.ABHANumber || data.healthIdNumber,
    abhaAddress: data.abhaAddress || data.healthId,
    name: data.name,
    gender: data.gender,
    yearOfBirth: data.yearOfBirth,
    monthOfBirth: data.monthOfBirth,
    dayOfBirth: data.dayOfBirth,
    mobile: data.mobile,
    email: data.email,
    address: data.address,
    districtName: data.districtName,
    stateName: data.stateName,
    pincode: data.pincode,
    profilePhoto: data.profilePhoto,
    kycVerified: data.kycVerified || false,
  }
}

// Fetch existing ABHA profile by number
export async function fetchAbhaProfile(
  config: AbdmConfig,
  token: string,
  abhaToken: string
): Promise<AbhaProfile> {
  const endpoints = getEndpoints(config.environment)

  const res = await fetch(`${endpoints.abha}/profile/account`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Token": `Bearer ${abhaToken}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Profile fetch failed: ${res.status} — ${text}`)
  }

  const data = await res.json()
  return {
    abhaNumber: data.ABHANumber || data.healthIdNumber,
    abhaAddress: data.abhaAddress || data.healthId,
    name: data.name,
    gender: data.gender,
    yearOfBirth: data.yearOfBirth,
    monthOfBirth: data.monthOfBirth,
    dayOfBirth: data.dayOfBirth,
    mobile: data.mobile,
    email: data.email,
    address: data.address,
    districtName: data.districtName,
    stateName: data.stateName,
    pincode: data.pincode,
    profilePhoto: data.profilePhoto,
    kycVerified: data.kycVerified || false,
  }
}

export interface AbhaProfile {
  abhaNumber: string
  abhaAddress: string
  name: string
  gender?: string
  yearOfBirth?: string
  monthOfBirth?: string
  dayOfBirth?: string
  mobile?: string
  email?: string
  address?: string
  districtName?: string
  stateName?: string
  pincode?: string
  profilePhoto?: string  // Base64
  kycVerified: boolean
}
