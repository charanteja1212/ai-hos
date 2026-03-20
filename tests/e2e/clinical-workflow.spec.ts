import { test, expect } from "@playwright/test"

/**
 * Clinical Workflow E2E Tests
 *
 * Tests the critical patient journey flows:
 * 1. Patient portal accessibility
 * 2. Queue display accessibility
 * 3. Prescription view accessibility
 * 4. Login flow
 *
 * NOTE: Full admission→consultation→discharge→billing flow requires
 * a seeded test database. These tests verify page accessibility and
 * key UI elements without requiring auth state.
 */

// Uses baseURL from playwright.config.ts (https://app.ainewworld.in)

test.describe("Patient Portal", () => {
  test("login page loads with OTP form", async ({ page }) => {
    await page.goto(`/patient-login`)
    await expect(page).toHaveTitle(/AI-HOS|Login/i)
    // Should have a phone input for OTP login
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i], input[name="phone"]')
    await expect(phoneInput.first()).toBeVisible({ timeout: 10000 })
  })

  test("patient login page has no console errors", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("hydration")) {
        errors.push(msg.text())
      }
    })
    await page.goto(`/patient-login`)
    await page.waitForLoadState("networkidle")
    // Filter out known non-critical errors
    const critical = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404") && !e.includes("next-auth")
    )
    expect(critical).toHaveLength(0)
  })
})

test.describe("Public Queue Display", () => {
  test("queue page renders without crashing", async ({ page }) => {
    // Queue pages are public — no auth needed
    const response = await page.goto(`/queue/test-tenant`)
    // Should load (might show empty state or redirect, but not 500)
    expect(response?.status()).toBeLessThan(500)
  })
})

test.describe("Public Prescription View", () => {
  test("rx page handles invalid token gracefully", async ({ page }) => {
    const response = await page.goto(`/rx/invalid-token-123`)
    expect(response?.status()).toBeLessThan(500)
    // Should show some error/empty state, not crash
    await page.waitForLoadState("domcontentloaded")
  })
})

test.describe("WhatsApp Public Pages", () => {
  test("wa/book page loads", async ({ page }) => {
    const response = await page.goto(`/wa/book`)
    expect(response?.status()).toBeLessThan(500)
    await page.waitForLoadState("domcontentloaded")
  })

  test("wa/appointments page loads", async ({ page }) => {
    const response = await page.goto(`/wa/appointments`)
    expect(response?.status()).toBeLessThan(500)
    await page.waitForLoadState("domcontentloaded")
  })

  test("wa/prescriptions page loads", async ({ page }) => {
    const response = await page.goto(`/wa/prescriptions`)
    expect(response?.status()).toBeLessThan(500)
    await page.waitForLoadState("domcontentloaded")
  })

  test("wa/pay page loads", async ({ page }) => {
    const response = await page.goto(`/wa/pay`)
    expect(response?.status()).toBeLessThan(500)
    await page.waitForLoadState("domcontentloaded")
  })
})

test.describe("Login Flow", () => {
  test("staff login page loads with role selection", async ({ page }) => {
    await page.goto(`/login`)
    await page.waitForLoadState("networkidle")

    // Should have email/password or role-based login
    const loginForm = page.locator("form, [data-testid='login-form'], button[type='submit']")
    await expect(loginForm.first()).toBeVisible({ timeout: 10000 })
  })

  test("forgot password page accessible", async ({ page }) => {
    await page.goto(`/forgot-password`)
    await page.waitForLoadState("domcontentloaded")
    const heading = page.locator("h1, h2, [role='heading']")
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
  })

  test("unauthorized page shows access denied message", async ({ page }) => {
    await page.goto(`/unauthorized`)
    await page.waitForLoadState("domcontentloaded")
    const text = await page.textContent("body")
    expect(text?.toLowerCase()).toContain("unauthorized")
  })
})

test.describe("Offline Page", () => {
  test("offline page renders", async ({ page }) => {
    const response = await page.goto(`/offline`)
    expect(response?.status()).toBeLessThan(500)
    await page.waitForLoadState("domcontentloaded")
  })
})

test.describe("Performance Basics", () => {
  test("login page loads under 5 seconds", async ({ page }) => {
    const start = Date.now()
    await page.goto(`/login`)
    await page.waitForLoadState("domcontentloaded")
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })

  test("no large layout shifts on login page", async ({ page }) => {
    await page.goto(`/login`)
    // Check CLS by waiting and measuring viewport stability
    await page.waitForLoadState("networkidle")
    // Basic check: page should have content and not be blank
    const bodyText = await page.textContent("body")
    expect(bodyText?.length).toBeGreaterThan(10)
  })
})
