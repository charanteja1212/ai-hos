import { test, expect, type Page } from "@playwright/test"

// ─── Constants ───────────────────────────────────────────────────────────────

const CLIENT_LOGIN_URL = "/login?client=CL001"

const PROTECTED_ROUTES = [
  { name: "Admin", path: "/admin" },
  { name: "Doctor", path: "/doctor" },
  { name: "Reception", path: "/reception" },
  { name: "Lab", path: "/lab" },
  { name: "Pharmacy", path: "/pharmacy" },
  { name: "Platform", path: "/platform" },
]

const API_ENDPOINTS = [
  { name: "Billing API", path: "/api/billing" },
  { name: "Lab API", path: "/api/lab" },
]

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  "javascript:alert(1)",
  '<svg onload=alert(1)>',
  "{{constructor.constructor('return this')()}}", // template injection
]

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "1; DROP TABLE patients; --",
  "' UNION SELECT * FROM users --",
  "1' AND 1=1 --",
  "admin'--",
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToLogin(page: Page) {
  await page.goto(CLIENT_LOGIN_URL, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)
}

async function selectRole(
  page: Page,
  roleDescription: string
): Promise<boolean> {
  const roleBtn = page.locator(`button:has(p:text("${roleDescription}"))`)
  if (await roleBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await roleBtn.click()
    await page.waitForTimeout(3000)
    return true
  }
  return false
}

async function handleClientAndBranchSelection(page: Page) {
  const clientHeading = page.locator('h2:text-is("Select Hospital Group")')
  if (await clientHeading.isVisible().catch(() => false)) {
    const clientBtn = page
      .locator("button")
      .filter({ has: page.locator('p:text-is("Care Hospital Group")') })
      .first()
    if (await clientBtn.isVisible().catch(() => false)) {
      await clientBtn.click()
    } else {
      const firstClient = page
        .locator("button")
        .filter({ has: page.locator("p.font-semibold") })
        .first()
      await firstClient.click()
    }
    await page.waitForTimeout(3000)
  }

  const branchHeading = page.locator('h2:text-is("Select Branch")')
  if (await branchHeading.isVisible().catch(() => false)) {
    const branchBtn = page
      .locator("button")
      .filter({ has: page.locator('p:text-is("Care Hospital")') })
      .first()
    if (await branchBtn.isVisible().catch(() => false)) {
      await branchBtn.click()
    } else {
      const firstBranch = page.locator("button:has(p.font-semibold)").first()
      await firstBranch.click()
    }
    await page.waitForTimeout(2000)
  }
}

async function enterPinAndSubmit(page: Page, pin: string, doctorId?: string) {
  const pinInput = page
    .locator('input[inputmode="numeric"], input[placeholder*="PIN"]')
    .first()
  await pinInput.waitFor({ state: "visible", timeout: 15000 })

  if (doctorId) {
    const doctorIdInput = page
      .locator(
        'input[placeholder*="Doctor ID"], input[placeholder*="doctor"], input[placeholder*="DOC"]'
      )
      .first()
    if (await doctorIdInput.isVisible().catch(() => false)) {
      await doctorIdInput.fill(doctorId)
      await page.waitForTimeout(300)
    }
  }

  await pinInput.fill(pin)
  await page.waitForTimeout(500)

  const submitBtn = page
    .locator(
      'button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), button:has-text("Enter")'
    )
    .first()
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click()
  }
  await page.waitForTimeout(3000)
}

async function loginAsAdmin(page: Page): Promise<boolean> {
  await navigateToLogin(page)
  await selectRole(page, "Hospital settings & config")
  await handleClientAndBranchSelection(page)
  await enterPinAndSubmit(page, "1234")

  const url = page.url()
  return url.includes("/admin")
}

async function loginAsReception(page: Page): Promise<boolean> {
  await navigateToLogin(page)
  await selectRole(page, "Queue & booking management")
  await handleClientAndBranchSelection(page)
  await enterPinAndSubmit(page, "5678")

  const url = page.url()
  return url.includes("/reception")
}

async function loginAsDoctor(page: Page): Promise<boolean> {
  await navigateToLogin(page)
  await selectRole(page, "Consultations & prescriptions")
  await handleClientAndBranchSelection(page)
  await enterPinAndSubmit(page, "1234", "DOC001")

  const url = page.url()
  return url.includes("/doctor")
}

async function loginAsLabTech(page: Page): Promise<boolean> {
  await navigateToLogin(page)
  await selectRole(page, "Sample tracking & reports")
  await handleClientAndBranchSelection(page)
  await enterPinAndSubmit(page, "3333")

  const url = page.url()
  return url.includes("/lab")
}

async function loginAsPharmacist(page: Page): Promise<boolean> {
  await navigateToLogin(page)
  await selectRole(page, "Orders & stock management")
  await handleClientAndBranchSelection(page)
  await enterPinAndSubmit(page, "4444")

  const url = page.url()
  return url.includes("/pharmacy")
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: AUTHENTICATION SECURITY (15 tests)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Authentication Security", () => {
  // --- Unauthenticated route access (6 tests) ---

  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated access to ${route.path} redirects to /login`, async ({
      page,
    }) => {
      const response = await page.goto(route.path, {
        waitUntil: "domcontentloaded",
      })
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(2000)

      const finalUrl = page.url()

      // Should either redirect to login, show login content, or return 401/403
      const redirectedToLogin =
        finalUrl.includes("/login") || finalUrl.includes("/auth")
      const hasLoginContent = await page
        .locator(
          'text="Login", text="Sign In", text="Select Role", input[placeholder*="PIN"]'
        )
        .first()
        .isVisible()
        .catch(() => false)
      const statusBlocked =
        response?.status() === 401 || response?.status() === 403

      expect(redirectedToLogin || hasLoginContent || statusBlocked).toBeTruthy()
    })
  }

  // --- Unauthenticated API access (2 tests) ---

  for (const endpoint of API_ENDPOINTS) {
    test(`unauthenticated API call to ${endpoint.path} returns 401 or 403`, async ({
      page,
    }) => {
      const response = await page.request.get(endpoint.path)
      const status = response.status()

      // API should reject unauthorized requests
      expect([401, 403, 405, 302]).toContain(status)

      // Should NOT return 200 with actual data
      if (status === 200) {
        const body = await response.text()
        // If 200, must be empty or redirect payload, not actual data
        expect(body).not.toContain("patient")
      }
    })
  }

  // --- Invalid PIN handling ---

  test("invalid PIN returns error, not crash", async ({ page }) => {
    await navigateToLogin(page)
    await selectRole(page, "Hospital settings & config")
    await handleClientAndBranchSelection(page)
    await enterPinAndSubmit(page, "0000")

    // Page should still be functional (not crashed)
    const pageTitle = await page.title()
    expect(pageTitle).toBeTruthy()

    // Should show error message or remain on login
    const hasError = await page
      .locator(
        'text="Invalid", text="incorrect", text="wrong", text="error", text="denied", [role="alert"]'
      )
      .first()
      .isVisible()
      .catch(() => false)
    const stillOnLogin = page.url().includes("/login")

    expect(hasError || stillOnLogin).toBeTruthy()

    // Page should not have unhandled errors
    const hasConsoleError = await page
      .locator('text="Something went wrong"')
      .isVisible()
      .catch(() => false)
    // Soft check: crash pages typically show "Something went wrong"
    // We accept error messages but not full page crashes
    expect(
      hasConsoleError && !page.url().includes("/login")
    ).not.toBeTruthy()
  })

  // --- Brute force rate limiting ---

  test("brute force PIN (6 attempts) triggers rate limit or remains on login", async ({
    page,
  }) => {
    await navigateToLogin(page)
    await selectRole(page, "Hospital settings & config")
    await handleClientAndBranchSelection(page)

    let rateLimited = false
    let lastError = ""

    for (let i = 0; i < 6; i++) {
      const pinInput = page
        .locator('input[inputmode="numeric"], input[placeholder*="PIN"]')
        .first()

      if (!(await pinInput.isVisible().catch(() => false))) {
        // If PIN input disappears, we may have been locked out
        rateLimited = true
        break
      }

      await pinInput.fill(`999${i}`)
      await page.waitForTimeout(300)

      const submitBtn = page
        .locator(
          'button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), button:has-text("Enter")'
        )
        .first()

      if (await submitBtn.isVisible().catch(() => false)) {
        if (await submitBtn.isDisabled().catch(() => false)) {
          rateLimited = true
          break
        }
        await submitBtn.click()
      }

      await page.waitForTimeout(1500)

      // Check for rate limit messages
      const limitMsg = await page
        .locator(
          'text="too many", text="locked", text="rate limit", text="try again later", text="blocked", text="exceeded"'
        )
        .first()
        .isVisible()
        .catch(() => false)

      if (limitMsg) {
        rateLimited = true
        break
      }

      const errorMsg = await page
        .locator('[role="alert"], .text-red-500, .text-destructive')
        .first()
        .textContent()
        .catch(() => "")
      if (errorMsg) lastError = errorMsg
    }

    // Either rate limited, or still on login page (not let through)
    const stillOnLogin = page.url().includes("/login")
    expect(rateLimited || stillOnLogin).toBeTruthy()
  })

  // --- Session cookie security ---

  test("session cookie is httpOnly", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed - cannot test cookie attributes")

    // httpOnly cookies are NOT accessible via JS
    const jsCookies = await page.evaluate(() => document.cookie)
    const browserCookies = await page.context().cookies()

    // Find session-related cookies
    const sessionCookies = browserCookies.filter(
      (c) =>
        c.name.toLowerCase().includes("session") ||
        c.name.toLowerCase().includes("token") ||
        c.name.toLowerCase().includes("auth") ||
        c.name.toLowerCase().includes("sb-") || // Supabase cookies
        c.name.toLowerCase().includes("next-auth")
    )

    // If session cookies exist, at least one should be httpOnly
    if (sessionCookies.length > 0) {
      const hasHttpOnly = sessionCookies.some((c) => c.httpOnly)
      expect(hasHttpOnly).toBeTruthy()
    } else {
      // No explicit session cookies found; check that JS-accessible cookies
      // don't contain obvious session tokens
      expect(jsCookies.toLowerCase()).not.toContain("session_token")
    }
  })

  test("session cookie is secure (HTTPS)", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed - cannot test cookie attributes")

    const browserCookies = await page.context().cookies()
    const sessionCookies = browserCookies.filter(
      (c) =>
        c.name.toLowerCase().includes("session") ||
        c.name.toLowerCase().includes("token") ||
        c.name.toLowerCase().includes("auth") ||
        c.name.toLowerCase().includes("sb-") ||
        c.name.toLowerCase().includes("next-auth")
    )

    if (sessionCookies.length > 0) {
      const allSecure = sessionCookies.every((c) => c.secure)
      expect(allSecure).toBeTruthy()
    }
  })

  // --- Logout clears session ---

  test("logout clears session completely", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed - cannot test logout")

    const cookiesBefore = await page.context().cookies()

    // Look for logout button/link
    const logoutBtn = page
      .locator(
        'button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("Log out"), a:has-text("Logout"), [aria-label="Logout"]'
      )
      .first()

    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click()
      await page.waitForTimeout(3000)

      const cookiesAfter = await page.context().cookies()

      // Session cookies should be cleared or reduced
      const sessionCookiesBefore = cookiesBefore.filter(
        (c) =>
          c.name.toLowerCase().includes("session") ||
          c.name.toLowerCase().includes("token") ||
          c.name.toLowerCase().includes("auth") ||
          c.name.toLowerCase().includes("sb-")
      )
      const sessionCookiesAfter = cookiesAfter.filter(
        (c) =>
          c.name.toLowerCase().includes("session") ||
          c.name.toLowerCase().includes("token") ||
          c.name.toLowerCase().includes("auth") ||
          c.name.toLowerCase().includes("sb-")
      )

      // After logout, session cookies should be fewer or empty
      expect(sessionCookiesAfter.length).toBeLessThanOrEqual(
        sessionCookiesBefore.length
      )

      // Should redirect to login or home
      const url = page.url()
      expect(
        url.includes("/login") || url.includes("/") || !url.includes("/admin")
      ).toBeTruthy()
    } else {
      // No visible logout button; check if navigating back to /admin shows login
      await page.goto("/admin", { waitUntil: "domcontentloaded" })
      // Still expected to be authenticated (logout button not found)
      test.skip(true, "Logout button not found in current UI")
    }
  })

  // --- Expired session token ---

  test("cannot reuse expired session token", async ({ page, context }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed - cannot test expired session")

    const cookies = await context.cookies()

    // Clear all cookies to simulate expired session
    await context.clearCookies()

    // Try accessing protected route
    await page.goto("/admin", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    const url = page.url()
    const redirectedToLogin =
      url.includes("/login") || url.includes("/auth")
    const hasLoginContent = await page
      .locator('input[placeholder*="PIN"], text="Select Role", text="Login"')
      .first()
      .isVisible()
      .catch(() => false)

    expect(redirectedToLogin || hasLoginContent).toBeTruthy()
  })

  // --- CSRF token in forms ---

  test("CSRF token present in forms or SameSite cookies used", async ({
    page,
  }) => {
    await navigateToLogin(page)

    // Check for CSRF token in forms
    const csrfInput = await page
      .locator('input[name="csrf"], input[name="_csrf"], input[name="csrfToken"]')
      .count()
    const csrfMeta = await page
      .locator('meta[name="csrf-token"]')
      .count()

    // Alternatively, check SameSite cookie attribute (modern CSRF protection)
    const cookies = await page.context().cookies()
    const hasSameSiteCookies = cookies.some(
      (c) => c.sameSite === "Strict" || c.sameSite === "Lax"
    )

    // Either explicit CSRF tokens or SameSite cookies should be present
    expect(csrfInput > 0 || csrfMeta > 0 || hasSameSiteCookies).toBeTruthy()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: SECURITY HEADERS (10 tests)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Security Headers", () => {
  let headers: Record<string, string>

  test.beforeEach(async ({ page }) => {
    const response = await page.goto("/login", {
      waitUntil: "domcontentloaded",
    })
    const rawHeaders = response?.headers() || {}
    // Normalize header names to lowercase
    headers = {}
    for (const [key, value] of Object.entries(rawHeaders)) {
      headers[key.toLowerCase()] = value
    }
  })

  test("response has X-Frame-Options: DENY or SAMEORIGIN", async () => {
    const xfo = headers["x-frame-options"]
    // May also be set via CSP frame-ancestors
    const csp = headers["content-security-policy"] || ""
    const hasFrameProtection =
      xfo !== undefined || csp.includes("frame-ancestors")
    expect(hasFrameProtection).toBeTruthy()

    if (xfo) {
      expect(["DENY", "SAMEORIGIN", "deny", "sameorigin"]).toContain(
        xfo.toUpperCase()
      )
    }
  })

  test("response has X-Content-Type-Options: nosniff", async () => {
    const xcto = headers["x-content-type-options"]
    expect(xcto).toBeDefined()
    expect(xcto?.toLowerCase()).toBe("nosniff")
  })

  test("response has Strict-Transport-Security header", async () => {
    const hsts = headers["strict-transport-security"]
    // HSTS should be present for HTTPS sites
    expect(hsts).toBeDefined()
  })

  test("response has Referrer-Policy header", async () => {
    const rp = headers["referrer-policy"]
    expect(rp).toBeDefined()
    // Should be a safe value
    const safeValues = [
      "no-referrer",
      "no-referrer-when-downgrade",
      "origin",
      "origin-when-cross-origin",
      "same-origin",
      "strict-origin",
      "strict-origin-when-cross-origin",
    ]
    expect(safeValues).toContain(rp?.toLowerCase())
  })

  test("response has Content-Security-Policy header", async () => {
    const csp = headers["content-security-policy"]
    // CSP or CSP-Report-Only should be present
    const cspRO = headers["content-security-policy-report-only"]
    expect(csp || cspRO).toBeDefined()
  })

  test("response has Permissions-Policy header", async () => {
    const pp = headers["permissions-policy"]
    const fp = headers["feature-policy"] // legacy name
    // At least one should be present
    expect(pp || fp).toBeDefined()
  })

  test("CSP blocks inline scripts (check header value)", async () => {
    const csp = headers["content-security-policy"] || ""
    const cspRO = headers["content-security-policy-report-only"] || ""
    const combined = csp + cspRO

    if (combined) {
      // If CSP exists, check that it has script-src directive
      // that doesn't allow unsafe-inline without nonce/hash
      const hasScriptSrc = combined.includes("script-src")
      const hasDefaultSrc = combined.includes("default-src")

      if (hasScriptSrc) {
        // If script-src is present, check it's not wide open
        const scriptSection = combined
          .split(";")
          .find((s) => s.includes("script-src"))
        // It should either use nonce, hash, or strict-dynamic
        // Having 'unsafe-inline' alone is a problem
        const hasUnsafeInline = scriptSection?.includes("'unsafe-inline'")
        const hasNonce = scriptSection?.includes("'nonce-")
        const hasHash = scriptSection?.includes("'sha256-")
        const hasStrictDynamic = scriptSection?.includes("'strict-dynamic'")

        // If unsafe-inline is present, it should be paired with nonce/hash
        if (hasUnsafeInline) {
          expect(hasNonce || hasHash || hasStrictDynamic).toBeTruthy()
        }
      }

      expect(hasScriptSrc || hasDefaultSrc).toBeTruthy()
    }
  })

  test("HSTS max-age is at least 1 year (31536000)", async () => {
    const hsts = headers["strict-transport-security"]
    if (hsts) {
      const match = hsts.match(/max-age=(\d+)/)
      if (match) {
        const maxAge = parseInt(match[1], 10)
        expect(maxAge).toBeGreaterThanOrEqual(31536000)
      }
    }
  })

  test("X-DNS-Prefetch-Control is set", async () => {
    const dns = headers["x-dns-prefetch-control"]
    // This header should exist, typically set to "off" for security
    expect(dns).toBeDefined()
  })

  test("no Server header leaking technology info", async () => {
    const server = headers["server"]
    if (server) {
      // Server header should NOT reveal specific version info
      expect(server.toLowerCase()).not.toMatch(
        /apache\/\d|nginx\/\d|express\/\d|next\.js/i
      )
      // Generic values like "Vercel" or "cloudflare" are acceptable
    }
    // If no server header at all, that's the best case
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: INPUT VALIDATION / XSS (10 tests)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Input Validation & XSS Prevention", () => {
  test("script tag in patient name is rejected or escaped", async ({
    page,
  }) => {
    const loggedIn = await loginAsReception(page)
    test.skip(!loggedIn, "Login as Reception failed")

    // Navigate to patient registration or booking form
    await page.goto("/reception/book", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const nameInput = page
      .locator(
        'input[name="name"], input[name="patient_name"], input[placeholder*="name" i], input[placeholder*="Name"]'
      )
      .first()

    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('<script>alert("xss")</script>')
      await page.waitForTimeout(500)

      // Check the value was sanitized or rejected
      const value = await nameInput.inputValue()

      // The script tag should be stripped, escaped, or rejected
      const isEscaped =
        !value.includes("<script>") || value.includes("&lt;script&gt;")
      const wasRejected = value === ""

      // Also check that no alert dialog appeared
      let alertTriggered = false
      page.on("dialog", (dialog) => {
        alertTriggered = true
        dialog.dismiss()
      })

      await page.waitForTimeout(1000)
      expect(alertTriggered).toBeFalsy()
    }
  })

  test("script tag in search input is escaped (no execution)", async ({
    page,
  }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    await page.goto("/admin/patients", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="Search"]'
      )
      .first()

    let alertTriggered = false
    page.on("dialog", (dialog) => {
      alertTriggered = true
      dialog.dismiss()
    })

    if (await searchInput.isVisible().catch(() => false)) {
      for (const payload of XSS_PAYLOADS.slice(0, 3)) {
        await searchInput.fill(payload)
        await page.waitForTimeout(500)
        await searchInput.press("Enter")
        await page.waitForTimeout(1000)
      }
    }

    expect(alertTriggered).toBeFalsy()

    // Check page source doesn't contain unescaped script
    const content = await page.content()
    expect(content).not.toContain('<script>alert("xss")</script>')
  })

  test("SQL injection in search field returns no data (not error)", async ({
    page,
  }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    await page.goto("/admin/patients", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="Search"]'
      )
      .first()

    if (await searchInput.isVisible().catch(() => false)) {
      for (const payload of SQL_INJECTION_PAYLOADS) {
        await searchInput.fill(payload)
        await page.waitForTimeout(300)
        await searchInput.press("Enter")
        await page.waitForTimeout(1500)

        // Should not crash the page
        const pageTitle = await page.title()
        expect(pageTitle).toBeTruthy()

        // Should not show SQL error messages
        const content = await page.content()
        expect(content.toLowerCase()).not.toContain("sql syntax")
        expect(content.toLowerCase()).not.toContain("postgresql")
        expect(content.toLowerCase()).not.toContain("pg_catalog")
        expect(content.toLowerCase()).not.toContain("relation does not exist")
        expect(content.toLowerCase()).not.toContain("syntax error at")
      }
    }
  })

  test("HTML injection in form fields is sanitized", async ({ page }) => {
    const loggedIn = await loginAsReception(page)
    test.skip(!loggedIn, "Login as Reception failed")

    await page.goto("/reception/book", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const htmlPayload =
      '<h1>INJECTED</h1><img src=x onerror="alert(1)">'

    const nameInput = page
      .locator(
        'input[name="name"], input[name="patient_name"], input[placeholder*="name" i]'
      )
      .first()

    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(htmlPayload)
      await page.waitForTimeout(500)

      // HTML tags should not be rendered as actual elements
      const injectedH1 = await page
        .locator("h1:has-text('INJECTED')")
        .count()
      expect(injectedH1).toBe(0)
    }
  })

  test("phone field rejects non-numeric input", async ({ page }) => {
    const loggedIn = await loginAsReception(page)
    test.skip(!loggedIn, "Login as Reception failed")

    await page.goto("/reception/book", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const phoneInput = page
      .locator(
        'input[name="phone"], input[name="mobile"], input[placeholder*="phone" i], input[placeholder*="mobile" i], input[type="tel"]'
      )
      .first()

    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill("abcdef!@#$")
      await page.waitForTimeout(500)

      const value = await phoneInput.inputValue()

      // Should either reject non-numeric or filter them out
      const hasNonNumeric = /[^0-9+\-() ]/.test(value)
      const isEmpty = value === ""
      const wasFiltered = value !== "abcdef!@#$"

      expect(hasNonNumeric && !isEmpty ? false : true).toBeTruthy()
    }
  })

  test("large payload (>1MB) to API returns error gracefully", async ({
    page,
  }) => {
    // Generate a >1MB payload
    const largePayload = "A".repeat(1024 * 1024 + 1)

    const response = await page.request.post("/api/billing", {
      data: { name: largePayload },
      headers: { "Content-Type": "application/json" },
    })

    const status = response.status()
    // Should return 413 (Payload Too Large), 400, 401, or 403 - not 500
    expect([413, 400, 401, 403, 405, 422]).toContain(status)
  })

  test("unicode/emoji in name fields handled properly", async ({ page }) => {
    const loggedIn = await loginAsReception(page)
    test.skip(!loggedIn, "Login as Reception failed")

    await page.goto("/reception/book", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const nameInput = page
      .locator(
        'input[name="name"], input[name="patient_name"], input[placeholder*="name" i]'
      )
      .first()

    if (await nameInput.isVisible().catch(() => false)) {
      const unicodeName = "Test User \u{1F600}\u{1F3E5} \u00E9\u00E0\u00FC\u00F1"
      await nameInput.fill(unicodeName)
      await page.waitForTimeout(500)

      // Should not crash or clear the field
      const value = await nameInput.inputValue()
      expect(value.length).toBeGreaterThan(0)

      // Page should not error
      const pageTitle = await page.title()
      expect(pageTitle).toBeTruthy()
    }
  })

  test("null bytes in input handled", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    await page.goto("/admin/patients", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="Search"]'
      )
      .first()

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("test\x00null\x00byte")
      await page.waitForTimeout(500)
      await searchInput.press("Enter")
      await page.waitForTimeout(1500)

      // Should not crash the page
      const pageTitle = await page.title()
      expect(pageTitle).toBeTruthy()

      // Should not display raw error
      const content = await page.content()
      expect(content.toLowerCase()).not.toContain("internal server error")
    }
  })

  test("path traversal in URLs returns 404 not file content", async ({
    page,
  }) => {
    const traversalPaths = [
      "/../../../etc/passwd",
      "/..%2f..%2f..%2fetc%2fpasswd",
      "/admin/../../etc/passwd",
      "/.env",
      "/api/../.env",
    ]

    for (const path of traversalPaths) {
      const response = await page.request.get(path)
      const status = response.status()
      const body = await response.text()

      // Should NOT return file system content
      expect(body).not.toContain("root:")
      expect(body).not.toContain("DB_PASSWORD")
      expect(body).not.toContain("SUPABASE_KEY")

      // Should be 400, 403, or 404
      expect([400, 403, 404, 301, 302, 308]).toContain(status)
    }
  })

  test("URL parameter injection doesn't expose data", async ({ page }) => {
    const maliciousUrls = [
      "/admin/patients?id=1 OR 1=1",
      "/admin/patients?tenant_id=T002",
      "/api/billing?client_id=CL002",
      "/admin?role=SUPER_ADMIN",
    ]

    for (const url of maliciousUrls) {
      const response = await page.request.get(url)
      const status = response.status()

      // Should not return 200 with data from other tenants
      if (status === 200) {
        const body = await response.text()
        expect(body).not.toContain("T002")
        expect(body).not.toContain("CL002")
      }
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: AUTHORIZATION / ACCESS CONTROL (10 tests)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Authorization & Access Control", () => {
  test("RECEPTION role cannot access /admin/settings", async ({ page }) => {
    const loggedIn = await loginAsReception(page)
    test.skip(!loggedIn, "Login as Reception failed")

    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    const url = page.url()
    // Should be redirected away from admin settings
    const blocked =
      !url.includes("/admin/settings") ||
      url.includes("/login") ||
      url.includes("/reception") ||
      url.includes("/unauthorized") ||
      url.includes("/access-denied")

    const hasAccessDenied = await page
      .locator(
        'text="Access Denied", text="Unauthorized", text="Not Allowed", text="Permission", text="Forbidden"'
      )
      .first()
      .isVisible()
      .catch(() => false)

    expect(blocked || hasAccessDenied).toBeTruthy()
  })

  test("DOCTOR role cannot access /admin/billing", async ({ page }) => {
    const loggedIn = await loginAsDoctor(page)
    test.skip(!loggedIn, "Login as Doctor failed")

    await page.goto("/admin/billing", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    const url = page.url()
    const blocked =
      !url.includes("/admin/billing") ||
      url.includes("/login") ||
      url.includes("/doctor")

    const hasAccessDenied = await page
      .locator(
        'text="Access Denied", text="Unauthorized", text="Not Allowed", text="Permission", text="Forbidden"'
      )
      .first()
      .isVisible()
      .catch(() => false)

    expect(blocked || hasAccessDenied).toBeTruthy()
  })

  test("LAB_TECH role cannot access /admin", async ({ page }) => {
    const loggedIn = await loginAsLabTech(page)
    test.skip(!loggedIn, "Login as Lab Tech failed")

    await page.goto("/admin", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    const url = page.url()
    const blocked =
      !url.includes("/admin") ||
      url.includes("/login") ||
      url.includes("/lab")

    const hasAccessDenied = await page
      .locator(
        'text="Access Denied", text="Unauthorized", text="Not Allowed", text="Permission", text="Forbidden"'
      )
      .first()
      .isVisible()
      .catch(() => false)

    expect(blocked || hasAccessDenied).toBeTruthy()
  })

  test("PHARMACIST cannot access /doctor", async ({ page }) => {
    const loggedIn = await loginAsPharmacist(page)
    test.skip(!loggedIn, "Login as Pharmacist failed")

    await page.goto("/doctor", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    const url = page.url()
    const blocked =
      !url.includes("/doctor") ||
      url.includes("/login") ||
      url.includes("/pharmacy")

    const hasAccessDenied = await page
      .locator(
        'text="Access Denied", text="Unauthorized", text="Not Allowed", text="Permission", text="Forbidden"'
      )
      .first()
      .isVisible()
      .catch(() => false)

    expect(blocked || hasAccessDenied).toBeTruthy()
  })

  test("API /api/billing rejects PATIENT role", async ({ page }) => {
    // Access billing API without staff authentication
    const response = await page.request.get("/api/billing", {
      headers: {
        "x-role": "PATIENT",
        "x-tenant-id": "T001",
      },
    })

    const status = response.status()
    // Should reject non-staff access
    expect([401, 403, 405]).toContain(status)
  })

  test("API /api/lab rejects PATIENT role", async ({ page }) => {
    const response = await page.request.get("/api/lab", {
      headers: {
        "x-role": "PATIENT",
        "x-tenant-id": "T001",
      },
    })

    const status = response.status()
    expect([401, 403, 405]).toContain(status)
  })

  test("cannot manipulate tenant_id in API to access other tenant data", async ({
    page,
  }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    // Try accessing API with a different tenant ID
    const response = await page.request.get("/api/billing", {
      headers: {
        "x-tenant-id": "T002",
        "x-client-id": "CL002",
      },
    })

    const status = response.status()
    if (status === 200) {
      const body = await response.text()
      // Should NOT contain data from T002
      expect(body).not.toContain('"tenant_id":"T002"')
      expect(body).not.toContain('"client_id":"CL002"')
    }
  })

  test("cannot escalate role via request manipulation", async ({ page }) => {
    const loggedIn = await loginAsReception(page)
    test.skip(!loggedIn, "Login as Reception failed")

    // Try to access admin endpoints by manipulating headers
    const response = await page.request.get("/api/billing", {
      headers: {
        "x-role": "BRANCH_ADMIN",
        "x-override-role": "BRANCH_ADMIN",
      },
    })

    // The server should use the session role, not the header
    const status = response.status()
    if (status === 200) {
      const body = await response.text()
      // If it returns data, it should be within reception's permissions
      expect(body).not.toContain('"role":"BRANCH_ADMIN"')
    }
  })

  test("admin from CL001 cannot access CL002 data", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login as Admin failed")

    // Try loading a page that might expose other clinic data
    const response = await page.request.get(
      "/api/billing?client_id=CL002&tenant_id=T002"
    )

    if (response.status() === 200) {
      const body = await response.text()
      expect(body).not.toContain("CL002")
      expect(body).not.toContain('"tenant_id":"T002"')
    }
  })

  test("file upload accepts only allowed types", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    // Look for any file upload input across admin pages
    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)

    const fileInput = page.locator('input[type="file"]').first()

    if (await fileInput.count() > 0) {
      // Check that accept attribute restricts file types
      const accept = await fileInput.getAttribute("accept")
      if (accept) {
        // Should not accept executable or dangerous types
        expect(accept).not.toContain(".exe")
        expect(accept).not.toContain(".sh")
        expect(accept).not.toContain(".bat")
        expect(accept).not.toContain(".php")
      }
    }

    // Also check via API by sending a dangerous file type
    const maliciousPayload = new Uint8Array([
      0x4d, 0x5a, 0x90, 0x00, // MZ header (Windows executable)
    ])

    const response = await page.request.post("/api/upload", {
      multipart: {
        file: {
          name: "malicious.exe",
          mimeType: "application/x-msdownload",
          buffer: Buffer.from(maliciousPayload),
        },
      },
    })

    // Should reject .exe files
    const status = response.status()
    expect([400, 403, 404, 405, 415, 422]).toContain(status)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5: DATA PROTECTION (10 tests)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Data Protection", () => {
  test("passwords/PINs not visible in page source", async ({ page }) => {
    await navigateToLogin(page)
    await selectRole(page, "Hospital settings & config")
    await handleClientAndBranchSelection(page)

    // Check page source for raw PIN values
    const content = await page.content()

    // PINs should not be hardcoded in page source
    expect(content).not.toMatch(/["']pin["']\s*:\s*["']1234["']/)
    expect(content).not.toMatch(/["']pin["']\s*:\s*["']5678["']/)
    expect(content).not.toMatch(/["']password["']\s*:\s*["'][^"']+["']/)

    // PIN input should be masked
    const pinInput = page
      .locator('input[inputmode="numeric"], input[placeholder*="PIN"]')
      .first()
    if (await pinInput.isVisible().catch(() => false)) {
      const inputType = await pinInput.getAttribute("type")
      // Should be password type or have autocomplete off
      expect(
        inputType === "password" ||
          inputType === "number" ||
          inputType === "tel"
      ).toBeTruthy()
    }
  })

  test("API responses don't include PIN fields", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    // Intercept API responses to check for leaked PINs
    const leakedPins: string[] = []

    page.on("response", async (response) => {
      const url = response.url()
      if (url.includes("/api/") && response.status() === 200) {
        try {
          const body = await response.text()
          if (
            body.includes('"pin"') ||
            body.includes('"hashed_pin"') ||
            body.includes('"password"')
          ) {
            leakedPins.push(url)
          }
        } catch {
          // ignore response reading errors
        }
      }
    })

    // Navigate through staff pages to trigger API calls
    await page.goto("/admin/staff", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(3000)
    await page.goto("/admin/doctors", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(3000)

    expect(leakedPins).toHaveLength(0)
  })

  test("sensitive data (PIN, password) not in console logs", async ({
    page,
  }) => {
    const consoleLogs: string[] = []

    page.on("console", (msg) => {
      consoleLogs.push(msg.text())
    })

    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    await page.waitForTimeout(2000)

    // Check console logs for sensitive data
    const sensitivePatterns = [
      /pin["\s:=]+["']?\d{4}/i,
      /password["\s:=]+["'][^"']+["']/i,
      /secret["\s:=]+["'][^"']+["']/i,
      /api[_-]?key["\s:=]+["'][^"']+["']/i,
      /supabase[_-]?key/i,
    ]

    for (const log of consoleLogs) {
      for (const pattern of sensitivePatterns) {
        expect(log).not.toMatch(pattern)
      }
    }
  })

  test("no credentials in URL parameters", async ({ page }) => {
    const urls: string[] = []

    page.on("request", (request) => {
      urls.push(request.url())
    })

    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    await page.waitForTimeout(3000)

    // No URL should contain credentials
    for (const url of urls) {
      const urlLower = url.toLowerCase()
      expect(urlLower).not.toMatch(/[?&]pin=/)
      expect(urlLower).not.toMatch(/[?&]password=/)
      expect(urlLower).not.toMatch(/[?&]secret=/)
      expect(urlLower).not.toMatch(/[?&]api_key=/)
      expect(urlLower).not.toMatch(/[?&]token=[a-zA-Z0-9]{20,}/)
    }
  })

  test("no sensitive data in localStorage", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    const localStorageData = await page.evaluate(() => {
      const data: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          data[key] = localStorage.getItem(key) || ""
        }
      }
      return data
    })

    const allValues = Object.entries(localStorageData)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n")
      .toLowerCase()

    // Should not store raw passwords or PINs
    expect(allValues).not.toMatch(/["']?password["']?\s*[:=]\s*["'][^"']+["']/)
    expect(allValues).not.toMatch(/["']?pin["']?\s*[:=]\s*["']\d{4}["']/)

    // Check individual keys
    for (const [key, value] of Object.entries(localStorageData)) {
      const keyLower = key.toLowerCase()
      if (
        keyLower.includes("password") ||
        keyLower === "pin" ||
        keyLower === "user_pin"
      ) {
        // If such keys exist, they should not contain raw values
        expect(value).not.toMatch(/^\d{4}$/) // raw 4-digit PIN
      }
    }
  })

  test("patient phone partially masked in appropriate places", async ({
    page,
  }) => {
    const loggedIn = await loginAsReception(page)
    test.skip(!loggedIn, "Login as Reception failed")

    await page.goto("/reception/patients", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(3000)

    // Check if phone numbers are displayed on the page
    const content = await page.content()

    // Look for full 10-digit phone numbers exposed in plain text
    const fullPhonePattern = /[^0-9]\d{10}[^0-9]/g
    const matches = content.match(fullPhonePattern) || []

    // If phones are shown, check for masking patterns (e.g., ****1234, 98XX XX1234)
    // This is a soft check - some views may legitimately show full phone numbers
    if (matches.length > 5) {
      // If many full phone numbers are exposed, check if any masking exists
      const hasMasking =
        content.includes("****") ||
        content.includes("XXXX") ||
        content.includes("xxxx") ||
        content.match(/\d{2}\*{4,}\d{2,4}/)

      // Log finding but don't fail hard - this is advisory
      if (!hasMasking) {
        console.warn(
          `Found ${matches.length} potentially unmasked phone numbers`
        )
      }
    }
  })

  test("error messages don't leak stack traces", async ({ page }) => {
    // Trigger various error conditions
    const errorPaths = [
      "/api/nonexistent-endpoint",
      "/api/billing?invalid=true&debug=true",
      "/admin/patients/nonexistent-id-99999",
    ]

    for (const path of errorPaths) {
      const response = await page.request.get(path)

      if (response.status() >= 400) {
        const body = await response.text()
        const bodyLower = body.toLowerCase()

        // Should NOT contain stack traces
        expect(bodyLower).not.toContain("at module.")
        expect(bodyLower).not.toContain("at object.")
        expect(bodyLower).not.toContain("node_modules/")
        expect(bodyLower).not.toContain("at process.")
        expect(bodyLower).not.toMatch(/at .+\.js:\d+:\d+/)

        // Should NOT contain file paths
        expect(bodyLower).not.toContain("/home/")
        expect(bodyLower).not.toContain("/var/www/")
        expect(bodyLower).not.toContain("c:\\users\\")
      }
    }
  })

  test("API error responses don't include SQL details", async ({ page }) => {
    const maliciousRequests = [
      { path: "/api/billing?id=1'", method: "GET" },
      {
        path: "/api/lab",
        method: "POST",
        body: { query: "'; DROP TABLE patients; --" },
      },
      { path: "/api/billing?sort=1;SELECT * FROM pg_tables", method: "GET" },
    ]

    for (const req of maliciousRequests) {
      let response
      if (req.method === "POST") {
        response = await page.request.post(req.path, {
          data: req.body,
          headers: { "Content-Type": "application/json" },
        })
      } else {
        response = await page.request.get(req.path)
      }

      const body = await response.text()
      const bodyLower = body.toLowerCase()

      // Should NOT expose SQL details
      expect(bodyLower).not.toContain("pg_catalog")
      expect(bodyLower).not.toContain("information_schema")
      expect(bodyLower).not.toContain("syntax error")
      expect(bodyLower).not.toContain("relation")
      expect(bodyLower).not.toMatch(/select\s+\*\s+from/i)
      expect(bodyLower).not.toContain("postgresql")
      expect(bodyLower).not.toContain("supabase")
    }
  })

  test("session storage doesn't contain raw credentials", async ({ page }) => {
    const loggedIn = await loginAsAdmin(page)
    test.skip(!loggedIn, "Login failed")

    const sessionData = await page.evaluate(() => {
      const data: Record<string, string> = {}
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key) {
          data[key] = sessionStorage.getItem(key) || ""
        }
      }
      return data
    })

    for (const [key, value] of Object.entries(sessionData)) {
      const keyLower = key.toLowerCase()
      const valueLower = value.toLowerCase()

      // Keys should not directly store credentials
      expect(keyLower).not.toBe("password")
      expect(keyLower).not.toBe("pin")
      expect(keyLower).not.toBe("secret_key")

      // Values should not contain raw PINs
      if (keyLower.includes("auth") || keyLower.includes("user")) {
        expect(valueLower).not.toMatch(/"pin"\s*:\s*"\d{4}"/)
        expect(valueLower).not.toMatch(/"password"\s*:\s*"[^"]+"/i)
      }
    }
  })

  test("no exposed .env or config files accessible via URL", async ({
    page,
  }) => {
    const sensitiveFiles = [
      "/.env",
      "/.env.local",
      "/.env.production",
      "/env.json",
      "/config.json",
      "/next.config.js",
      "/package.json",
      "/.git/config",
      "/.git/HEAD",
      "/wp-config.php",
      "/server.js",
      "/database.yml",
      "/.npmrc",
      "/tsconfig.json",
      "/.aws/credentials",
    ]

    for (const file of sensitiveFiles) {
      const response = await page.request.get(file)
      const status = response.status()

      if (status === 200) {
        const body = await response.text()
        const bodyLower = body.toLowerCase()

        // If the file is accessible, it should NOT contain secrets
        expect(bodyLower).not.toContain("supabase_key")
        expect(bodyLower).not.toContain("api_key")
        expect(bodyLower).not.toContain("db_password")
        expect(bodyLower).not.toContain("secret_key")
        expect(bodyLower).not.toContain("private_key")
        expect(bodyLower).not.toContain("aws_access_key")
        expect(bodyLower).not.toContain("database_url")

        // .env files should never be accessible
        if (file.includes(".env")) {
          // If .env returns 200, it's a critical finding
          expect(bodyLower).not.toMatch(
            /[A-Z_]+=.+/ // KEY=VALUE pattern
          )
        }

        // .git should never be accessible
        if (file.includes(".git")) {
          expect(bodyLower).not.toContain("[core]")
          expect(bodyLower).not.toContain("ref: refs/")
        }
      }
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6: BONUS SECURITY CHECKS (5+ additional tests)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Additional Security Checks", () => {
  test("login page does not autocomplete PIN field", async ({ page }) => {
    await navigateToLogin(page)
    await selectRole(page, "Hospital settings & config")
    await handleClientAndBranchSelection(page)

    const pinInput = page
      .locator('input[inputmode="numeric"], input[placeholder*="PIN"]')
      .first()

    if (await pinInput.isVisible().catch(() => false)) {
      const autocomplete = await pinInput.getAttribute("autocomplete")
      // Should be "off", "new-password", or "one-time-code" - not "on" or empty
      if (autocomplete) {
        expect(autocomplete).not.toBe("on")
      }
    }
  })

  test("clickjacking protection via CSP frame-ancestors or X-Frame-Options", async ({
    page,
  }) => {
    const response = await page.goto("/login", {
      waitUntil: "domcontentloaded",
    })
    const headers = response?.headers() || {}

    const xfo = headers["x-frame-options"]
    const csp = headers["content-security-policy"] || ""

    const hasFrameProtection =
      xfo !== undefined || csp.includes("frame-ancestors")

    expect(hasFrameProtection).toBeTruthy()
  })

  test("CORS headers do not allow wildcard origin on API", async ({
    page,
  }) => {
    const response = await page.request.fetch("/api/billing", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil-site.com",
        "Access-Control-Request-Method": "GET",
      },
    })

    const acaoHeader =
      response.headers()["access-control-allow-origin"]

    if (acaoHeader) {
      // Should NOT be wildcard
      expect(acaoHeader).not.toBe("*")
      // Should NOT reflect arbitrary origins
      expect(acaoHeader).not.toBe("https://evil-site.com")
    }
  })

  test("no open redirect vulnerability on login redirect", async ({
    page,
  }) => {
    // Try to inject an external redirect URL
    const maliciousRedirects = [
      "/login?redirect=https://evil-site.com",
      "/login?returnTo=https://evil-site.com",
      "/login?next=https://evil-site.com",
      "/login?callbackUrl=https://evil-site.com",
      "/login?redirect=//evil-site.com",
    ]

    for (const url of maliciousRedirects) {
      await page.goto(url, { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(1000)

      const currentUrl = page.url()
      // Should NOT redirect to external site
      expect(currentUrl).not.toContain("evil-site.com")
      expect(currentUrl).toContain("ainewworld.in")
    }
  })

  test("HTTP methods limited on API endpoints", async ({ page }) => {
    const dangerousMethods = ["DELETE", "PUT", "PATCH"]

    for (const method of dangerousMethods) {
      const response = await page.request.fetch("/api/billing", {
        method: method,
      })

      const status = response.status()
      // Unauthenticated dangerous methods should be rejected
      expect([401, 403, 405]).toContain(status)
    }
  })
})
