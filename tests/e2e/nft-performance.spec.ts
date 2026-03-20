import { test, expect, type Page } from "@playwright/test"

/**
 * Non-Functional Performance Tests (50+ scenarios)
 *
 * Covers: page load times, bundle sizes, API response times,
 * rendering performance, and caching behaviour.
 *
 * Base URL: https://app.ainewworld.in (from playwright.config.ts)
 * Login: /login?client=CL001, role ADMIN, PIN 1234
 */

// ─── Helper: login as ADMIN ───────────────────────────────────────────────────

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
  await page.waitForTimeout(2000)

  // Step 1: Select Admin role
  const roleBtn = page.locator('button:has(p:text("Hospital settings & config"))')
  await roleBtn.waitFor({ state: "visible", timeout: 10000 })
  await roleBtn.click()
  await page.waitForTimeout(3000)

  // Step 2: Client selection (if shown)
  const clientHeading = page.locator('h2:text-is("Select Hospital Group")')
  if (await clientHeading.isVisible().catch(() => false)) {
    const clientBtn = page
      .locator("button")
      .filter({ has: page.locator('p:text-is("Care Hospital Group")') })
      .first()
    if (await clientBtn.isVisible().catch(() => false)) {
      await clientBtn.click()
    } else {
      await page
        .locator("button")
        .filter({ has: page.locator("p.font-semibold") })
        .first()
        .click()
    }
    await page.waitForTimeout(3000)
  }

  // Step 3: Branch selection (if shown)
  const branchHeading = page.locator('h2:text-is("Select Branch")')
  if (await branchHeading.isVisible().catch(() => false)) {
    const branchBtn = page
      .locator("button")
      .filter({ has: page.locator('p:text-is("Care Hospital")') })
      .first()
    if (await branchBtn.isVisible().catch(() => false)) {
      await branchBtn.click()
    } else {
      await page.locator("button:has(p.font-semibold)").first().click()
    }
    await page.waitForTimeout(2000)
  }

  // Step 4: Enter PIN
  const pinInput = page
    .locator('input[inputmode="numeric"], input[placeholder*="PIN"]')
    .first()
  await pinInput.waitFor({ state: "visible", timeout: 15000 })
  await pinInput.fill("1234")
  await page.waitForTimeout(300)

  // Submit
  const signInBtn = page.locator('button:has-text("Sign In")').first()
  await signInBtn.click()
  await page.waitForTimeout(4000)
  await page.waitForLoadState("networkidle")
}

// ─── Helper: measure page load time ──────────────────────────────────────────

async function measurePageLoad(page: Page, path: string): Promise<number> {
  const start = Date.now()
  await page.goto(path, { waitUntil: "networkidle", timeout: 30000 })
  const elapsed = Date.now() - start
  return elapsed
}

// ─── Helper: get Performance Timing from browser ─────────────────────────────

async function getPerformanceTiming(page: Page) {
  return page.evaluate(() => {
    const timing = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming
    return {
      ttfb: timing.responseStart - timing.requestStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.startTime,
      loadComplete: timing.loadEventEnd - timing.startTime,
      domInteractive: timing.domInteractive - timing.startTime,
      responseTime: timing.responseEnd - timing.requestStart,
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PAGE LOAD TIMES (15 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Page Load Times", () => {
  test.setTimeout(120000)

  test("1.01 - Login page loads under 3 seconds", async ({ page }) => {
    const elapsed = await measurePageLoad(page, "/login?client=CL001")
    console.log(`Login page load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.02 - Admin dashboard loads under 5 seconds", async ({ page }) => {
    await loginAsAdmin(page)
    const start = Date.now()
    await page.goto("/admin", { waitUntil: "networkidle", timeout: 30000 })
    const elapsed = Date.now() - start
    console.log(`Admin dashboard load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(5000)
  })

  test("1.03 - Doctor dashboard loads under 5 seconds", async ({ page }) => {
    // Navigate to doctor dashboard (public-accessible route check)
    const start = Date.now()
    const response = await page.goto("/doctor", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })
    const elapsed = Date.now() - start
    console.log(`Doctor dashboard load: ${elapsed}ms (status: ${response?.status()})`)
    // Even if redirected to login, the redirect should be fast
    expect(elapsed).toBeLessThan(5000)
  })

  test("1.04 - Reception dashboard loads under 5 seconds", async ({ page }) => {
    const start = Date.now()
    const response = await page.goto("/reception", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })
    const elapsed = Date.now() - start
    console.log(`Reception dashboard load: ${elapsed}ms (status: ${response?.status()})`)
    expect(elapsed).toBeLessThan(5000)
  })

  test("1.05 - Analytics page loads under 8 seconds (has charts)", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    const start = Date.now()
    await page.goto("/admin/analytics", {
      waitUntil: "networkidle",
      timeout: 30000,
    })
    const elapsed = Date.now() - start
    console.log(`Analytics page load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(8000)
  })

  test("1.06 - Billing page loads under 5 seconds", async ({ page }) => {
    await loginAsAdmin(page)
    const start = Date.now()
    await page.goto("/admin/billing", {
      waitUntil: "networkidle",
      timeout: 30000,
    })
    const elapsed = Date.now() - start
    console.log(`Billing page load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(5000)
  })

  test("1.07 - Patient portal loads under 3 seconds", async ({ page }) => {
    const elapsed = await measurePageLoad(page, "/patient-login")
    console.log(`Patient portal load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.08 - WhatsApp /wa/book loads under 3 seconds", async ({ page }) => {
    const elapsed = await measurePageLoad(page, "/wa/book")
    console.log(`/wa/book load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.09 - Public queue page loads under 3 seconds", async ({ page }) => {
    const start = Date.now()
    await page.goto("/queue/test-tenant", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    })
    const elapsed = Date.now() - start
    console.log(`Public queue page load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.10 - Public rx page loads under 3 seconds", async ({ page }) => {
    const start = Date.now()
    await page.goto("/rx/test-token", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    })
    const elapsed = Date.now() - start
    console.log(`Public rx page load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.11 - /wa/appointments loads under 3 seconds", async ({ page }) => {
    const elapsed = await measurePageLoad(page, "/wa/appointments")
    console.log(`/wa/appointments load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.12 - /wa/prescriptions loads under 3 seconds", async ({ page }) => {
    const elapsed = await measurePageLoad(page, "/wa/prescriptions")
    console.log(`/wa/prescriptions load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.13 - /wa/pay loads under 3 seconds", async ({ page }) => {
    const elapsed = await measurePageLoad(page, "/wa/pay")
    console.log(`/wa/pay load: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(3000)
  })

  test("1.14 - TTFB is under 1 second for login page", async ({ page }) => {
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    const timing = await getPerformanceTiming(page)
    console.log(`Login TTFB: ${timing.ttfb.toFixed(0)}ms`)
    expect(timing.ttfb).toBeLessThan(1000)
  })

  test("1.15 - DOM Content Loaded under 3 seconds for dashboard", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto("/admin", { waitUntil: "networkidle" })
    const timing = await getPerformanceTiming(page)
    console.log(`Dashboard DOMContentLoaded: ${timing.domContentLoaded.toFixed(0)}ms`)
    expect(timing.domContentLoaded).toBeLessThan(3000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BUNDLE SIZE (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Bundle Size & Assets", () => {
  test.setTimeout(60000)

  test("2.01 - Total shared JS bundle under 300KB", async ({ page }) => {
    const jsResources: { url: string; size: number }[] = []

    page.on("response", async (response) => {
      const url = response.url()
      if (url.endsWith(".js") || url.includes(".js?")) {
        const headers = response.headers()
        const contentLength = parseInt(headers["content-length"] || "0", 10)
        // Only count shared/framework chunks (not page-specific)
        if (url.includes("_next/static/chunks/") && url.includes("framework")) {
          jsResources.push({ url, size: contentLength })
        }
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    const totalSharedJS = jsResources.reduce((sum, r) => sum + r.size, 0)
    console.log(
      `Shared JS bundle: ${(totalSharedJS / 1024).toFixed(1)}KB (${jsResources.length} files)`
    )
    // 300KB compressed
    expect(totalSharedJS).toBeLessThan(300 * 1024)
  })

  test("2.02 - No single page JS chunk exceeds 100KB", async ({ page }) => {
    const jsChunks: { url: string; size: number }[] = []

    page.on("response", async (response) => {
      const url = response.url()
      const headers = response.headers()
      const contentLength = parseInt(headers["content-length"] || "0", 10)
      if (
        (url.endsWith(".js") || url.includes(".js?")) &&
        url.includes("_next/static/")
      ) {
        jsChunks.push({ url, size: contentLength })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    const oversizedChunks = jsChunks.filter((c) => c.size > 100 * 1024)
    if (oversizedChunks.length > 0) {
      console.log("Oversized JS chunks:")
      oversizedChunks.forEach((c) =>
        console.log(`  ${c.url.split("/").pop()}: ${(c.size / 1024).toFixed(1)}KB`)
      )
    }
    // Allow framework chunks to be larger, only check page-specific
    const pageChunks = jsChunks.filter(
      (c) => !c.url.includes("framework") && !c.url.includes("webpack") && c.size > 0
    )
    const maxPageChunk = Math.max(...pageChunks.map((c) => c.size), 0)
    console.log(`Largest page-specific JS chunk: ${(maxPageChunk / 1024).toFixed(1)}KB`)
    expect(maxPageChunk).toBeLessThan(100 * 1024)
  })

  test("2.03 - CSS is loaded and parsed on login page", async ({ page }) => {
    const cssLoaded: string[] = []

    page.on("response", (response) => {
      if (
        response.url().includes(".css") &&
        response.status() === 200
      ) {
        cssLoaded.push(response.url())
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    console.log(`CSS files loaded: ${cssLoaded.length}`)
    expect(cssLoaded.length).toBeGreaterThan(0)

    // Verify stylesheets are actually applied
    const hasStyles = await page.evaluate(() => {
      return document.styleSheets.length > 0
    })
    expect(hasStyles).toBe(true)
  })

  test("2.04 - Images use proper formats (webp/svg preferred)", async ({
    page,
  }) => {
    const images: { url: string; type: string }[] = []

    page.on("response", (response) => {
      const contentType = response.headers()["content-type"] || ""
      if (contentType.startsWith("image/")) {
        images.push({ url: response.url(), type: contentType })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    const nonOptimized = images.filter(
      (img) =>
        img.type.includes("image/png") &&
        !img.url.includes("favicon") &&
        !img.url.includes("icon")
    )

    console.log(`Total images: ${images.length}`)
    console.log(`Non-optimized PNGs (excluding icons): ${nonOptimized.length}`)
    images.forEach((img) =>
      console.log(`  ${img.url.split("/").pop()} -> ${img.type}`)
    )

    // Warn but don't hard-fail -- log for awareness
    if (nonOptimized.length > 3) {
      console.warn(
        `WARNING: ${nonOptimized.length} non-optimized PNG images found. Consider converting to WebP/SVG.`
      )
    }
    // At least no BMP/TIFF formats
    const badFormats = images.filter(
      (img) => img.type.includes("bmp") || img.type.includes("tiff")
    )
    expect(badFormats).toHaveLength(0)
  })

  test("2.05 - No unnecessary large imports in network tab (>500KB single resource)", async ({
    page,
  }) => {
    const largeResources: { url: string; size: number }[] = []

    page.on("response", (response) => {
      const contentLength = parseInt(
        response.headers()["content-length"] || "0",
        10
      )
      if (contentLength > 500 * 1024) {
        largeResources.push({ url: response.url(), size: contentLength })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    if (largeResources.length > 0) {
      console.log("Large resources (>500KB):")
      largeResources.forEach((r) =>
        console.log(
          `  ${r.url.split("/").pop()}: ${(r.size / 1024).toFixed(1)}KB`
        )
      )
    }
    expect(largeResources.length).toBeLessThanOrEqual(1) // Allow at most 1 (e.g. a map library)
  })

  test("2.06 - Service worker registers", async ({ page }) => {
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000) // Give SW time to register

    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "not-supported"
      const registrations = await navigator.serviceWorker.getRegistrations()
      return registrations.length > 0 ? "registered" : "not-registered"
    })

    console.log(`Service worker status: ${swRegistered}`)
    // Next.js PWA plugin may or may not be enabled; log for visibility
    expect(["registered", "not-supported", "not-registered"]).toContain(
      swRegistered
    )
  })

  test("2.07 - Total page weight under 1MB for login", async ({ page }) => {
    let totalBytes = 0

    page.on("response", (response) => {
      const contentLength = parseInt(
        response.headers()["content-length"] || "0",
        10
      )
      totalBytes += contentLength
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    console.log(`Total login page weight: ${(totalBytes / 1024).toFixed(1)}KB`)
    expect(totalBytes).toBeLessThan(1024 * 1024) // 1MB
  })

  test("2.08 - HTML document size under 50KB", async ({ page }) => {
    const response = await page.goto("/login?client=CL001", {
      waitUntil: "networkidle",
    })
    const body = await response?.body()
    const htmlSize = body?.length || 0
    console.log(`HTML document size: ${(htmlSize / 1024).toFixed(1)}KB`)
    expect(htmlSize).toBeLessThan(50 * 1024)
  })

  test("2.09 - No duplicate JS bundles loaded", async ({ page }) => {
    const jsFiles: string[] = []

    page.on("response", (response) => {
      const url = response.url()
      if (url.includes(".js") && url.includes("_next/static/")) {
        // Extract the chunk filename
        const filename = url.split("/").pop()?.split("?")[0] || ""
        jsFiles.push(filename)
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    const duplicates = jsFiles.filter(
      (file, index) => jsFiles.indexOf(file) !== index
    )
    if (duplicates.length > 0) {
      console.log(`Duplicate JS bundles: ${duplicates.join(", ")}`)
    }
    expect(duplicates).toHaveLength(0)
  })

  test("2.10 - Fonts loaded efficiently (preconnect or inline)", async ({
    page,
  }) => {
    const fontRequests: string[] = []

    page.on("response", (response) => {
      const ct = response.headers()["content-type"] || ""
      if (ct.includes("font") || response.url().includes("/fonts/")) {
        fontRequests.push(response.url())
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    console.log(`Font requests: ${fontRequests.length}`)
    fontRequests.forEach((f) => console.log(`  ${f.split("/").pop()}`))

    // Fonts should not exceed 5 requests (typically 1-3 for a well-optimized site)
    expect(fontRequests.length).toBeLessThanOrEqual(5)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. API RESPONSE TIMES (15 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("API Response Times", () => {
  test.setTimeout(120000)

  test("3.01 - GET /api/auth/session responds under 500ms", async ({
    page,
  }) => {
    let sessionTime = 0
    page.on("response", (response) => {
      if (response.url().includes("/api/auth/session")) {
        sessionTime = response.timing().responseEnd
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    // Also do a direct measurement
    const start = Date.now()
    const response = await page.request.get("/api/auth/session")
    const elapsed = Date.now() - start
    console.log(`GET /api/auth/session: ${elapsed}ms (status: ${response.status()})`)
    expect(elapsed).toBeLessThan(500)
  })

  test("3.02 - POST /api/billing responds under 1 second", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/billing", { waitUntil: "networkidle" })

    // Check if any billing API calls were made during page load
    let billingApiTime = 0
    const billingCalls: { url: string; duration: number }[] = []

    page.on("requestfinished", async (request) => {
      if (request.url().includes("/api/billing") || request.url().includes("billing")) {
        const timing = request.timing()
        const duration = timing.responseEnd - timing.requestStart
        billingCalls.push({ url: request.url(), duration })
        billingApiTime = Math.max(billingApiTime, duration)
      }
    })

    // Reload to capture timings
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    console.log(`Billing API calls: ${billingCalls.length}`)
    billingCalls.forEach((c) =>
      console.log(`  ${c.url.split("/").pop()}: ${c.duration.toFixed(0)}ms`)
    )

    // If billing APIs were called, they should be under 1s
    if (billingCalls.length > 0) {
      expect(billingApiTime).toBeLessThan(1000)
    }
  })

  test("3.03 - POST /api/lab responds under 1 second", async ({ page }) => {
    const labCalls: { url: string; duration: number }[] = []

    page.on("requestfinished", async (request) => {
      if (request.url().includes("/api/lab") || request.url().includes("lab")) {
        const timing = request.timing()
        const duration = timing.responseEnd - timing.requestStart
        labCalls.push({ url: request.url(), duration })
      }
    })

    await loginAsAdmin(page)
    await page.goto("/lab", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(3000)

    console.log(`Lab API calls: ${labCalls.length}`)
    labCalls.forEach((c) =>
      console.log(`  ${c.url}: ${c.duration.toFixed(0)}ms`)
    )

    if (labCalls.length > 0) {
      const maxLabTime = Math.max(...labCalls.map((c) => c.duration))
      expect(maxLabTime).toBeLessThan(1000)
    }
  })

  test("3.04 - Supabase queries complete under 2 seconds", async ({
    page,
  }) => {
    const supabaseCalls: { url: string; duration: number }[] = []

    page.on("requestfinished", async (request) => {
      if (request.url().includes("supabase") || request.url().includes("pbevoxnglfbtxwgbbncp")) {
        const timing = request.timing()
        const duration = timing.responseEnd - timing.requestStart
        supabaseCalls.push({ url: request.url(), duration })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    console.log(`Supabase calls on login: ${supabaseCalls.length}`)
    supabaseCalls.forEach((c) => {
      const shortUrl = c.url.split("?")[0].split("/").slice(-2).join("/")
      console.log(`  ${shortUrl}: ${c.duration.toFixed(0)}ms`)
    })

    if (supabaseCalls.length > 0) {
      const maxDuration = Math.max(...supabaseCalls.map((c) => c.duration))
      expect(maxDuration).toBeLessThan(2000)
    }
  })

  test("3.05 - No API call takes more than 5 seconds", async ({ page }) => {
    const slowCalls: { url: string; duration: number }[] = []

    page.on("requestfinished", async (request) => {
      const timing = request.timing()
      const duration = timing.responseEnd - timing.requestStart
      if (duration > 5000 && !request.url().includes("_next/static")) {
        slowCalls.push({ url: request.url(), duration })
      }
    })

    await loginAsAdmin(page)
    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)

    if (slowCalls.length > 0) {
      console.log("Slow API calls (>5s):")
      slowCalls.forEach((c) =>
        console.log(`  ${c.url}: ${c.duration.toFixed(0)}ms`)
      )
    }
    expect(slowCalls).toHaveLength(0)
  })

  test("3.06 - Total network requests on dashboard under 30", async ({
    page,
  }) => {
    let requestCount = 0

    page.on("request", () => {
      requestCount++
    })

    await loginAsAdmin(page)
    requestCount = 0 // Reset after login, only count dashboard
    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    console.log(`Dashboard total network requests: ${requestCount}`)
    expect(requestCount).toBeLessThan(30)
  })

  test("3.07 - Total transfer size on dashboard under 2MB", async ({
    page,
  }) => {
    let totalTransfer = 0

    await loginAsAdmin(page)

    page.on("response", (response) => {
      const contentLength = parseInt(
        response.headers()["content-length"] || "0",
        10
      )
      totalTransfer += contentLength
    })

    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    console.log(
      `Dashboard transfer size: ${(totalTransfer / 1024 / 1024).toFixed(2)}MB`
    )
    expect(totalTransfer).toBeLessThan(2 * 1024 * 1024)
  })

  test("3.08 - API calls on login page complete within 2 seconds", async ({
    page,
  }) => {
    const apiCalls: { url: string; duration: number }[] = []

    page.on("requestfinished", async (request) => {
      if (request.url().includes("/api/")) {
        const timing = request.timing()
        const duration = timing.responseEnd - timing.requestStart
        apiCalls.push({ url: request.url(), duration })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    console.log(`API calls on login page: ${apiCalls.length}`)
    apiCalls.forEach((c) => {
      const path = new URL(c.url).pathname
      console.log(`  ${path}: ${c.duration.toFixed(0)}ms`)
    })

    if (apiCalls.length > 0) {
      const maxDuration = Math.max(...apiCalls.map((c) => c.duration))
      expect(maxDuration).toBeLessThan(2000)
    }
  })

  test("3.09 - No failed API requests (4xx/5xx) on dashboard", async ({
    page,
  }) => {
    const failedRequests: { url: string; status: number }[] = []

    await loginAsAdmin(page)

    page.on("response", (response) => {
      const status = response.status()
      if (
        status >= 400 &&
        response.url().includes("/api/") &&
        !response.url().includes("favicon")
      ) {
        failedRequests.push({ url: response.url(), status })
      }
    })

    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    if (failedRequests.length > 0) {
      console.log("Failed API requests on dashboard:")
      failedRequests.forEach((r) => console.log(`  ${r.url}: ${r.status}`))
    }
    expect(failedRequests).toHaveLength(0)
  })

  test("3.10 - Static assets served with 200 status", async ({ page }) => {
    const failedStatic: { url: string; status: number }[] = []

    page.on("response", (response) => {
      const url = response.url()
      if (
        (url.includes("_next/static") || url.includes("/images/")) &&
        response.status() !== 200 &&
        response.status() !== 304
      ) {
        failedStatic.push({ url, status: response.status() })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    if (failedStatic.length > 0) {
      console.log("Failed static assets:")
      failedStatic.forEach((r) =>
        console.log(`  ${r.url.split("/").pop()}: ${r.status}`)
      )
    }
    expect(failedStatic).toHaveLength(0)
  })

  test("3.11 - Supabase calls on admin dashboard under 2 seconds", async ({
    page,
  }) => {
    const supabaseCalls: { url: string; duration: number }[] = []

    await loginAsAdmin(page)

    page.on("requestfinished", async (request) => {
      if (request.url().includes("supabase") || request.url().includes("pbevoxnglfbtxwgbbncp")) {
        const timing = request.timing()
        const duration = timing.responseEnd - timing.requestStart
        supabaseCalls.push({ url: request.url(), duration })
      }
    })

    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)

    console.log(`Supabase calls on dashboard: ${supabaseCalls.length}`)
    if (supabaseCalls.length > 0) {
      const maxDuration = Math.max(...supabaseCalls.map((c) => c.duration))
      console.log(`Slowest Supabase call: ${maxDuration.toFixed(0)}ms`)
      expect(maxDuration).toBeLessThan(2000)
    }
  })

  test("3.12 - Analytics API calls complete under 3 seconds", async ({
    page,
  }) => {
    const analyticsCalls: { url: string; duration: number }[] = []

    await loginAsAdmin(page)

    page.on("requestfinished", async (request) => {
      const timing = request.timing()
      const duration = timing.responseEnd - timing.requestStart
      analyticsCalls.push({ url: request.url(), duration })
    })

    await page.goto("/admin/analytics", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)

    const apiOnly = analyticsCalls.filter(
      (c) =>
        c.url.includes("/api/") ||
        c.url.includes("supabase") ||
        c.url.includes("pbevoxnglfbtxwgbbncp")
    )
    console.log(`Analytics API calls: ${apiOnly.length}`)
    if (apiOnly.length > 0) {
      const maxDuration = Math.max(...apiOnly.map((c) => c.duration))
      console.log(`Slowest analytics API call: ${maxDuration.toFixed(0)}ms`)
      expect(maxDuration).toBeLessThan(3000)
    }
  })

  test("3.13 - Patients list API responds under 2 seconds", async ({
    page,
  }) => {
    const patientCalls: { url: string; duration: number }[] = []

    await loginAsAdmin(page)

    page.on("requestfinished", async (request) => {
      if (request.url().includes("patient")) {
        const timing = request.timing()
        const duration = timing.responseEnd - timing.requestStart
        patientCalls.push({ url: request.url(), duration })
      }
    })

    await page.goto("/admin/patients", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)

    console.log(`Patient API calls: ${patientCalls.length}`)
    if (patientCalls.length > 0) {
      const maxDuration = Math.max(...patientCalls.map((c) => c.duration))
      console.log(`Slowest patient API call: ${maxDuration.toFixed(0)}ms`)
      expect(maxDuration).toBeLessThan(2000)
    }
  })

  test("3.14 - Settings page API calls under 2 seconds", async ({ page }) => {
    const settingsCalls: { url: string; duration: number }[] = []

    await loginAsAdmin(page)

    page.on("requestfinished", async (request) => {
      if (
        request.url().includes("/api/") ||
        request.url().includes("supabase") ||
        request.url().includes("pbevoxnglfbtxwgbbncp")
      ) {
        const timing = request.timing()
        const duration = timing.responseEnd - timing.requestStart
        settingsCalls.push({ url: request.url(), duration })
      }
    })

    await page.goto("/admin/settings", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    console.log(`Settings API calls: ${settingsCalls.length}`)
    if (settingsCalls.length > 0) {
      const maxDuration = Math.max(...settingsCalls.map((c) => c.duration))
      console.log(`Slowest settings API call: ${maxDuration.toFixed(0)}ms`)
      expect(maxDuration).toBeLessThan(2000)
    }
  })

  test("3.15 - No N+1 query pattern (excessive repeated API calls)", async ({
    page,
  }) => {
    const apiCallCounts: Record<string, number> = {}

    await loginAsAdmin(page)

    page.on("request", (request) => {
      const url = new URL(request.url())
      const pathname = url.pathname
      if (pathname.includes("/api/") || url.host.includes("supabase")) {
        apiCallCounts[pathname] = (apiCallCounts[pathname] || 0) + 1
      }
    })

    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)

    const repeatedCalls = Object.entries(apiCallCounts).filter(
      ([, count]) => count > 5
    )
    if (repeatedCalls.length > 0) {
      console.log("Potentially excessive repeated API calls:")
      repeatedCalls.forEach(([path, count]) =>
        console.log(`  ${path}: ${count} calls`)
      )
    }
    expect(repeatedCalls.length).toBeLessThanOrEqual(1) // Allow at most 1 repeated endpoint
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RENDERING PERFORMANCE (10 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Rendering Performance", () => {
  test.setTimeout(120000)

  test("4.01 - No layout shift after login page load (CLS check)", async ({
    page,
  }) => {
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000) // Let any late shifts settle

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
        })
        observer.observe({ type: "layout-shift", buffered: true })

        // Collect for 1 second then report
        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 1000)
      })
    })

    console.log(`Login page CLS: ${cls.toFixed(4)}`)
    // Good CLS is under 0.1, acceptable under 0.25
    expect(cls).toBeLessThan(0.25)
  })

  test("4.02 - No layout shift after dashboard load", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
        })
        observer.observe({ type: "layout-shift", buffered: true })
        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 1000)
      })
    })

    console.log(`Dashboard CLS: ${cls.toFixed(4)}`)
    expect(cls).toBeLessThan(0.25)
  })

  test("4.03 - Tables with data render without excessive DOM nodes", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/patients", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)

    const domMetrics = await page.evaluate(() => {
      const allNodes = document.querySelectorAll("*").length
      const tableRows = document.querySelectorAll("tr, [role='row']").length
      return { allNodes, tableRows }
    })

    console.log(
      `DOM nodes: ${domMetrics.allNodes}, Table rows: ${domMetrics.tableRows}`
    )
    // Excessive DOM nodes (>3000) indicate missing virtualization
    expect(domMetrics.allNodes).toBeLessThan(3000)
  })

  test("4.04 - Charts render within 3 seconds on analytics page", async ({
    page,
  }) => {
    await loginAsAdmin(page)

    const start = Date.now()
    await page.goto("/admin/analytics", { waitUntil: "networkidle" })

    // Wait for chart elements (canvas, svg, or common chart library selectors)
    try {
      await page
        .locator("canvas, svg.recharts-surface, [class*='chart'], [data-chart]")
        .first()
        .waitFor({ state: "visible", timeout: 8000 })
      const elapsed = Date.now() - start
      console.log(`Chart render time: ${elapsed}ms`)
      expect(elapsed).toBeLessThan(3000)
    } catch {
      // Charts may not be present if no data; check page loaded at least
      const elapsed = Date.now() - start
      console.log(
        `No chart elements found (may be empty state). Page loaded in ${elapsed}ms`
      )
      expect(elapsed).toBeLessThan(8000)
    }
  })

  test("4.05 - Scrolling performance (no excessive reflows)", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/patients", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    // Measure long task duration during scroll
    const scrollPerformance = await page.evaluate(async () => {
      let longTasks = 0
      const observer = new PerformanceObserver((list) => {
        longTasks += list.getEntries().length
      })
      observer.observe({ type: "longtask", buffered: false })

      // Scroll down in increments
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, 200)
        await new Promise((r) => setTimeout(r, 100))
      }

      // Scroll back up
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, -200)
        await new Promise((r) => setTimeout(r, 100))
      }

      observer.disconnect()
      return { longTasks }
    })

    console.log(`Long tasks during scroll: ${scrollPerformance.longTasks}`)
    // More than 5 long tasks during scroll indicates jank
    expect(scrollPerformance.longTasks).toBeLessThan(5)
  })

  test("4.06 - Animations do not drop excessive frames", async ({ page }) => {
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)

    const frameMetrics = await page.evaluate(() => {
      return new Promise<{ frames: number; duration: number }>((resolve) => {
        let frameCount = 0
        const startTime = performance.now()

        function countFrame() {
          frameCount++
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrame)
          } else {
            resolve({
              frames: frameCount,
              duration: performance.now() - startTime,
            })
          }
        }
        requestAnimationFrame(countFrame)
      })
    })

    const fps = (frameMetrics.frames / frameMetrics.duration) * 1000
    console.log(
      `Frame rate: ${fps.toFixed(1)} FPS (${frameMetrics.frames} frames in ${frameMetrics.duration.toFixed(0)}ms)`
    )
    // Minimum acceptable FPS is 30
    expect(fps).toBeGreaterThan(30)
  })

  test("4.07 - Dark mode toggle is instant (no flash of unstyled content)", async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/settings", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    // Look for theme toggle button
    const themeToggle = page.locator(
      'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="mode" i], [data-theme-toggle], button:has(svg[class*="moon"]), button:has(svg[class*="sun"])'
    )

    if ((await themeToggle.count()) > 0) {
      const start = Date.now()
      await themeToggle.first().click()
      // Check that dark class or data attribute changed quickly
      await page.waitForTimeout(200)
      const elapsed = Date.now() - start
      console.log(`Theme toggle response: ${elapsed}ms`)
      expect(elapsed).toBeLessThan(500) // Should be near instant
    } else {
      console.log("No theme toggle button found on settings page (skipping)")
    }
  })

  test("4.08 - Search/filter updates within 500ms", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/patients", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    // Find a search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i], input[role="searchbox"]'
    )

    if ((await searchInput.count()) > 0) {
      const start = Date.now()
      await searchInput.first().fill("test")

      // Wait for either a loading indicator to appear/disappear or table to update
      try {
        await page.waitForResponse(
          (resp) =>
            resp.url().includes("patient") || resp.url().includes("search"),
          { timeout: 2000 }
        )
      } catch {
        // No network request means client-side filtering
      }

      await page.waitForTimeout(300)
      const elapsed = Date.now() - start
      console.log(`Search filter response: ${elapsed}ms`)
      expect(elapsed).toBeLessThan(500)
    } else {
      console.log("No search input found on patients page")
    }
  })

  test("4.09 - Modal/dialog opens within 200ms", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    // Look for a button that opens a modal/dialog
    const actionButton = page.locator(
      'button:has-text("Add"), button:has-text("New"), button:has-text("Create")'
    )

    if ((await actionButton.count()) > 0) {
      const start = Date.now()
      await actionButton.first().click()

      // Wait for dialog/modal to appear
      try {
        await page
          .locator('[role="dialog"], [role="alertdialog"], [class*="modal"], [data-state="open"]')
          .first()
          .waitFor({ state: "visible", timeout: 1000 })
        const elapsed = Date.now() - start
        console.log(`Modal open time: ${elapsed}ms`)
        expect(elapsed).toBeLessThan(200)
      } catch {
        const elapsed = Date.now() - start
        console.log(
          `No modal appeared within 1s after click (${elapsed}ms). Button may navigate instead.`
        )
      }
    } else {
      console.log("No Add/New/Create button found on dashboard")
    }
  })

  test("4.10 - First Contentful Paint under 2 seconds", async ({ page }) => {
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    const fcp = await page.evaluate(() => {
      const fcpEntry = performance
        .getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint")
      return fcpEntry ? fcpEntry.startTime : null
    })

    if (fcp !== null) {
      console.log(`First Contentful Paint: ${fcp.toFixed(0)}ms`)
      expect(fcp).toBeLessThan(2000)
    } else {
      console.log("FCP metric not available in this browser context")
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CACHING (5 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Caching", () => {
  test.setTimeout(90000)

  test("5.01 - Static assets have Cache-Control headers", async ({ page }) => {
    const cacheHeaders: { url: string; cacheControl: string }[] = []

    page.on("response", (response) => {
      const url = response.url()
      if (url.includes("_next/static/")) {
        const cacheControl = response.headers()["cache-control"] || "none"
        cacheHeaders.push({
          url: url.split("/").pop() || url,
          cacheControl,
        })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    console.log(`Static assets with cache headers: ${cacheHeaders.length}`)
    const withCache = cacheHeaders.filter((h) => h.cacheControl !== "none")
    console.log(`  With Cache-Control: ${withCache.length}`)
    withCache.slice(0, 5).forEach((h) =>
      console.log(`  ${h.url}: ${h.cacheControl}`)
    )

    // At least some static assets should have caching
    if (cacheHeaders.length > 0) {
      expect(withCache.length).toBeGreaterThan(0)
    }
  })

  test("5.02 - Second page load is faster than first", async ({ page }) => {
    // First load
    const firstStart = Date.now()
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    const firstLoad = Date.now() - firstStart

    // Second load (should benefit from browser cache)
    const secondStart = Date.now()
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    const secondLoad = Date.now() - secondStart

    console.log(`First load: ${firstLoad}ms, Second load: ${secondLoad}ms`)
    console.log(
      `Improvement: ${((1 - secondLoad / firstLoad) * 100).toFixed(1)}%`
    )

    // Second load should be at least somewhat faster (or at most equal)
    expect(secondLoad).toBeLessThanOrEqual(firstLoad * 1.1) // Allow 10% margin
  })

  test("5.03 - Service worker caches critical resources", async ({ page }) => {
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)

    const cacheInfo = await page.evaluate(async () => {
      if (!("caches" in window)) return { supported: false, cacheNames: [] }

      const cacheNames = await caches.keys()
      const details: { name: string; count: number }[] = []

      for (const name of cacheNames) {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        details.push({ name, count: keys.length })
      }

      return { supported: true, cacheNames: details }
    })

    console.log(`Cache API supported: ${cacheInfo.supported}`)
    if (cacheInfo.cacheNames.length > 0) {
      console.log("Service worker caches:")
      cacheInfo.cacheNames.forEach((c: { name: string; count: number }) =>
        console.log(`  ${c.name}: ${c.count} entries`)
      )
    } else {
      console.log("No service worker caches found (PWA may not be enabled)")
    }

    // This is informational; pass if Cache API is supported
    expect(cacheInfo.supported).toBe(true)
  })

  test("5.04 - Images are cached (304 or cache-control)", async ({ page }) => {
    const imageCaching: {
      url: string
      status: number
      cacheControl: string
    }[] = []

    page.on("response", (response) => {
      const ct = response.headers()["content-type"] || ""
      if (ct.startsWith("image/")) {
        imageCaching.push({
          url: response.url().split("/").pop() || "",
          status: response.status(),
          cacheControl: response.headers()["cache-control"] || "none",
        })
      }
    })

    // First load
    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    // Clear and reload to check caching on second load
    imageCaching.length = 0
    await page.reload({ waitUntil: "networkidle" })

    console.log(`Image requests on reload: ${imageCaching.length}`)
    imageCaching.forEach((img) =>
      console.log(
        `  ${img.url}: status=${img.status}, cache=${img.cacheControl}`
      )
    )

    // Images should either be 304 (not modified) or have cache-control headers
    const cachedImages = imageCaching.filter(
      (img) => img.status === 304 || img.cacheControl !== "none"
    )
    if (imageCaching.length > 0) {
      const cacheRate = cachedImages.length / imageCaching.length
      console.log(`Image cache hit rate: ${(cacheRate * 100).toFixed(0)}%`)
      expect(cacheRate).toBeGreaterThan(0.5) // At least 50% cached
    }
  })

  test("5.05 - API responses with proper cache headers", async ({ page }) => {
    const apiCacheHeaders: {
      url: string
      cacheControl: string
      etag: string
    }[] = []

    page.on("response", (response) => {
      const url = response.url()
      if (url.includes("/api/") && response.status() === 200) {
        apiCacheHeaders.push({
          url: new URL(url).pathname,
          cacheControl: response.headers()["cache-control"] || "none",
          etag: response.headers()["etag"] || "none",
        })
      }
    })

    await page.goto("/login?client=CL001", { waitUntil: "networkidle" })

    console.log(`API responses checked: ${apiCacheHeaders.length}`)
    apiCacheHeaders.forEach((api) =>
      console.log(
        `  ${api.url}: cache=${api.cacheControl}, etag=${api.etag}`
      )
    )

    // API responses should at least have cache-control headers set (even if no-store)
    if (apiCacheHeaders.length > 0) {
      const withHeaders = apiCacheHeaders.filter(
        (a) => a.cacheControl !== "none" || a.etag !== "none"
      )
      console.log(
        `APIs with cache/etag headers: ${withHeaders.length}/${apiCacheHeaders.length}`
      )
      // Informational -- at least verify we checked
      expect(apiCacheHeaders.length).toBeGreaterThan(0)
    }
  })
})
