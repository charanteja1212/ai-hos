import { test, expect } from "@playwright/test"

test.describe("Login Page Visual Test", () => {
  test("role selection step - screenshot", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: `tests/e2e/screenshots/login-roles-${test.info().project.name}.png`,
      fullPage: true,
    })
    // Verify key elements
    await expect(page.locator("text=Welcome back")).toBeVisible()
    await expect(page.getByRole("button", { name: /Doctor/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Reception/ })).toBeVisible()
  })

  test("credentials step - click a role", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)
    // Click on Platform Admin (goes straight to credentials, no API calls)
    const adminBtn = page.locator("button", { hasText: "Platform Admin" })
    await adminBtn.click()
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: `tests/e2e/screenshots/login-credentials-${test.info().project.name}.png`,
      fullPage: true,
    })
  })
})
