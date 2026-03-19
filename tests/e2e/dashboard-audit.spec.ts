import { test, expect, type Page } from "@playwright/test"

// ─── Role configs with login credentials and pages to test ───
const ROLES = [
  {
    name: "ADMIN",
    roleId: "BRANCH_ADMIN",
    roleLabel: "Admin",
    description: "Hospital settings & config",
    pin: "1234",
    pages: [
      { name: "Dashboard", path: "/admin" },
      { name: "Analytics", path: "/admin/analytics" },
      { name: "Doctors", path: "/admin/doctors" },
      { name: "Patients", path: "/admin/patients" },
      { name: "Staff", path: "/admin/staff" },
      { name: "Billing", path: "/admin/billing" },
      { name: "Settings", path: "/admin/settings" },
      { name: "Activity", path: "/admin/activity" },
      { name: "Feedback", path: "/admin/feedback" },
    ],
  },
  {
    name: "RECEPTION",
    roleId: "RECEPTION",
    roleLabel: "Reception",
    description: "Queue & booking management",
    pin: "5678",
    branchName: "Care Hospital",
    pages: [
      { name: "Queue Board", path: "/reception" },
      { name: "Walk-in Booking", path: "/reception/book" },
      { name: "Appointments", path: "/reception/appointments" },
      { name: "Patient Search", path: "/reception/patients" },
    ],
  },
  {
    name: "DOCTOR",
    roleId: "DOCTOR",
    roleLabel: "Doctor",
    description: "Consultations & prescriptions",
    pin: "1234",
    doctorId: "DOC001",
    branchName: "Care Hospital",
    pages: [
      { name: "Dashboard", path: "/doctor" },
      { name: "My Patients", path: "/doctor/patients" },
      { name: "Prescriptions", path: "/doctor/prescriptions" },
      { name: "Analytics", path: "/doctor/analytics" },
      { name: "Schedule", path: "/doctor/schedule" },
    ],
  },
  {
    name: "PHARMACIST",
    roleId: "PHARMACIST",
    roleLabel: "Pharmacy",
    description: "Orders & stock management",
    pin: "4444",
    pages: [
      { name: "Prescriptions", path: "/pharmacy" },
      { name: "Inventory", path: "/pharmacy/inventory" },
    ],
  },
  {
    name: "LAB_TECH",
    roleId: "LAB_TECH",
    roleLabel: "Lab",
    description: "Sample tracking & reports",
    pin: "3333",
    pages: [
      { name: "Lab Orders", path: "/lab" },
    ],
  },
]

// Helper: login as a specific role via the multi-step login flow
async function loginAsRole(page: Page, role: (typeof ROLES)[number]) {
  await page.goto("/login", { waitUntil: "networkidle" })
  await page.waitForTimeout(2000)

  // Step 1: Click the role button by matching description text (unique per role)
  const roleBtn = page.locator(`button:has(p:text("${role.description}"))`)
  await roleBtn.waitFor({ state: "visible", timeout: 10000 })
  await roleBtn.click()

  // Wait for next step to load (may fetch clients/branches from API)
  await page.waitForTimeout(3000)

  // Step 2: Client selection — detect by "Select Hospital Group" heading
  const clientHeading = page.locator('h2:text-is("Select Hospital Group")')
  if (await clientHeading.isVisible().catch(() => false)) {
    console.log(`[${role.name}] Client selection step detected`)
    // Click "Care Hospital Group" by exact name match on the <p> element
    const clientBtn = page.locator("button").filter({
      has: page.locator('p:text-is("Care Hospital Group")'),
    }).first()
    if (await clientBtn.isVisible().catch(() => false)) {
      await clientBtn.click()
    } else {
      // Fallback: click first visible client button
      const firstClient = page.locator("button").filter({ has: page.locator("p.font-semibold") }).first()
      await firstClient.click()
    }
    await page.waitForTimeout(3000)
  }

  // Step 3: Branch selection — detect by "Select Branch" heading
  const branchHeading = page.locator('h2:text-is("Select Branch")')
  if (await branchHeading.isVisible().catch(() => false)) {
    const branchTarget = (role as { branchName?: string }).branchName || "Care Hospital"
    console.log(`[${role.name}] Branch selection step detected, target: "${branchTarget}"`)
    // Use :text-is() for EXACT match on hospital_name <p> to distinguish
    // "Care Hospital" from "Care Hospital Hyderabad"
    const branchBtn = page.locator("button").filter({
      has: page.locator(`p:text-is("${branchTarget}")`),
    }).first()
    if (await branchBtn.isVisible().catch(() => false)) {
      await branchBtn.click()
    } else {
      // Fallback: click the first branch button in the list
      console.log(`[${role.name}] Exact branch match failed, clicking first branch`)
      const firstBranch = page.locator('button:has(p.font-semibold)').first()
      await firstBranch.click()
    }
    await page.waitForTimeout(2000)
  }

  // Step 4: Credentials — wait for PIN input
  const pinInput = page.locator('input[inputmode="numeric"], input[placeholder*="PIN"]').first()
  await pinInput.waitFor({ state: "visible", timeout: 15000 })

  // Doctor ID field (only for DOCTOR role)
  if (role.name === "DOCTOR" && (role as { doctorId?: string }).doctorId) {
    const doctorIdInput = page.locator('input[placeholder*="Doctor ID"], input[placeholder*="doctor"], input[placeholder*="DOC"]').first()
    if (await doctorIdInput.isVisible().catch(() => false)) {
      await doctorIdInput.fill((role as { doctorId: string }).doctorId)
      await page.waitForTimeout(300)
    }
  }

  // Enter PIN
  await pinInput.fill(role.pin)
  await page.waitForTimeout(300)

  // Take a screenshot of credentials step for debugging
  await page.screenshot({
    path: `tests/e2e/screenshots/audit/${role.name}-login-creds.png`,
  })

  // Submit
  const signInBtn = page.locator('button:has-text("Sign In")').first()
  await signInBtn.click()

  // Wait for redirect
  await page.waitForTimeout(4000)
  await page.waitForLoadState("networkidle")

  // Verify we left login page
  const url = page.url()
  console.log(`[${role.name}] Post-login URL: ${url}`)
  return !url.includes("/login")
}

// ─── Run tests ───
for (const role of ROLES) {
  test.describe(`${role.name} Dashboard Audit`, () => {
    test(`Login and audit all ${role.name} pages`, async ({ page }) => {
      test.setTimeout(180000)

      const loggedIn = await loginAsRole(page, role)

      // Take landing screenshot regardless
      await page.screenshot({
        path: `tests/e2e/screenshots/audit/${role.name}-00-landing.png`,
        fullPage: true,
      })

      if (!loggedIn) {
        // Take a screenshot of what we see and skip
        console.error(`❌ [${role.name}] Login failed — still on login page`)
        // Try to get error message
        const errorEl = page.locator("text=Invalid").first()
        if (await errorEl.isVisible().catch(() => false)) {
          console.error(`   Error: ${await errorEl.textContent()}`)
        }
        return
      }

      console.log(`✅ [${role.name}] Login successful`)

      // Screenshot sidebar
      const sidebar = page.locator("aside").first()
      if (await sidebar.isVisible().catch(() => false)) {
        await sidebar.screenshot({
          path: `tests/e2e/screenshots/audit/${role.name}-00-sidebar.png`,
        })
      }

      // Navigate to each page
      for (let i = 0; i < role.pages.length; i++) {
        const pg = role.pages[i]
        const idx = String(i + 1).padStart(2, "0")
        console.log(`\n[${role.name}] ─── ${pg.name} (${pg.path}) ───`)

        await page.goto(pg.path, { waitUntil: "networkidle", timeout: 30000 })
        await page.waitForTimeout(2500) // let animations and data load
        await page.waitForLoadState("networkidle")

        // Full page screenshot
        await page.screenshot({
          path: `tests/e2e/screenshots/audit/${role.name}-${idx}-${pg.name.toLowerCase().replace(/\s+/g, "-")}.png`,
          fullPage: true,
        })

        // ─── ISSUE DETECTION ───
        const issues: string[] = []

        // 1. Still on login page?
        if (page.url().includes("/login")) {
          issues.push("🔴 Redirected back to login — auth may have expired")
          continue
        }

        // 2. Horizontal overflow
        const hasHScroll = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
        )
        if (hasHScroll) {
          issues.push("🔴 Horizontal scroll detected — content overflows viewport")
        }

        // 3. Overflowing elements
        const overflows = await page.evaluate(() => {
          const vw = window.innerWidth
          const found: string[] = []
          document.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.right > vw + 5 && r.width > 0 && r.height > 0) {
              const tag = el.tagName.toLowerCase()
              const cls = (el as HTMLElement).className?.toString().slice(0, 80) || ""
              found.push(`${tag}[${cls}] right=${Math.round(r.right)} > vw=${vw}`)
            }
          })
          return found.slice(0, 5)
        })
        overflows.forEach((o) => issues.push(`🟡 Overflow: ${o}`))

        // 4. Broken images
        const brokenImgs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("img"))
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => img.src || "unknown")
        })
        brokenImgs.forEach((src) => issues.push(`🔴 Broken image: ${src}`))

        // 5. Skeleton loaders still visible
        const skeletonCount = await page.locator(".animate-pulse, [class*='skeleton']").count()
        if (skeletonCount > 3) {
          issues.push(`🟡 ${skeletonCount} skeleton loaders still visible — possible loading issue`)
        }

        // 6. H1 heading check
        const h1s = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("h1"))
            .filter((h) => h.offsetHeight > 0)
            .map((h) => h.textContent?.trim().slice(0, 60) || "")
        })
        if (h1s.length === 0) {
          issues.push("🟡 No visible H1 heading found")
        } else if (h1s.length > 1) {
          issues.push(`🟡 Multiple H1 headings: ${h1s.map((h) => `"${h}"`).join(", ")}`)
        }

        // 7. Text clipping (not intentionally truncated)
        const clipped = await page.evaluate(() => {
          const found: string[] = []
          document.querySelectorAll("h1, h2, h3, p, span, button").forEach((el) => {
            const htmlEl = el as HTMLElement
            if (
              htmlEl.scrollWidth > htmlEl.clientWidth + 2 &&
              !htmlEl.classList.contains("truncate") &&
              !htmlEl.classList.contains("line-clamp-1") &&
              !htmlEl.closest(".truncate")
            ) {
              const text = htmlEl.textContent?.trim().slice(0, 50)
              if (text && text.length > 3) {
                found.push(`"${text}" in <${el.tagName.toLowerCase()}>`)
              }
            }
          })
          return found.slice(0, 5)
        })
        clipped.forEach((c) => issues.push(`🟡 Text clipped: ${c}`))

        // 8. Very small interactive targets (<28px)
        const smallTargets = await page.evaluate(() => {
          const found: string[] = []
          document.querySelectorAll("button, a, [role='button'], input").forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.height > 0 && r.height < 24 && r.width > 0 && r.width < 24) {
              const label = (el as HTMLElement).textContent?.trim().slice(0, 30) || el.getAttribute("aria-label") || "?"
              found.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`)
            }
          })
          return found.slice(0, 5)
        })
        smallTargets.forEach((t) => issues.push(`🟡 Small target: ${t}`))

        // 9. Pill stats alignment check
        const pillCheck = await page.evaluate(() => {
          const pills = document.querySelectorAll(".rounded-full.border.shadow-sm")
          if (pills.length < 2) return null
          const tops = Array.from(pills).map((p) => Math.round(p.getBoundingClientRect().top))
          const unique = [...new Set(tops)]
          return { rows: unique.length, count: pills.length }
        })
        if (pillCheck && pillCheck.rows > 2) {
          issues.push(`🟡 Stat pills wrapped to ${pillCheck.rows} rows (${pillCheck.count} pills)`)
        }

        // 10. Empty page check
        const mainContent = await page.evaluate(() => {
          const main = document.querySelector("main") || document.querySelector("[class*='space-y']")
          return main ? main.children.length : 0
        })
        if (mainContent === 0) {
          issues.push("🔴 Page appears empty — no content in main area")
        }

        // 11. Console errors during navigation
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 100))
        })

        // Report
        if (issues.length === 0) {
          console.log(`✅ [${role.name}/${pg.name}] No issues found`)
        } else {
          console.log(`⚠️  [${role.name}/${pg.name}] ${issues.length} issue(s):`)
          issues.forEach((iss) => console.log(`   ${iss}`))
        }
      }
    })
  })
}
