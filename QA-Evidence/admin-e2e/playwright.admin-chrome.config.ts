// Temporary config OUTSIDE the repository: runs the admin E2E suite on the
// installed Google Chrome (channel "chrome") instead of a downloaded Chromium.
// Everything else comes from apps/admin/playwright.config.ts unchanged.
import { defineConfig, devices } from "<repo>/apps/admin/node_modules/@playwright/test";
import base from "<repo>/apps/admin/playwright.config.ts";

export default defineConfig({
  ...base,
  testDir: "<repo>/apps/admin/e2e",
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: { ...base.webServer, cwd: "<repo>/apps/admin" },
});
