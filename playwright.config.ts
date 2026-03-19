import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/test-results",
  timeout: 60000,
  use: {
    baseURL: "https://app.ainewworld.in",
    screenshot: "on",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "Desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "Mobile",
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
})
