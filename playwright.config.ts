import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration for the Argus auth flow.
 *
 * We start a *separate* Next.js dev server on port 3001 (not 3000) so that
 * any existing local dev server is never used — it would have the real Supabase
 * URL rather than the mock server URL.
 *
 * Environment variables passed to the Next.js dev server:
 *   NEXT_PUBLIC_SUPABASE_URL         → our mock Supabase server (localhost:54321)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY    → stub (mock ignores the key)
 *   SUPABASE_SERVICE_ROLE_KEY        → stub
 *   NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES → 1 minute (accelerated for timeout test)
 *
 * Next.js reads .env.local but never overrides already-set process.env keys,
 * so the values below take precedence over any real credentials in .env.local.
 */

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false, // run serially — all tests share the same Next.js server
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  globalSetup: "./e2e/global-setup",
  globalTeardown: "./e2e/global-teardown",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // Start Next.js on port 3001 so we never reuse the dev server on 3000.
    command: `npx next dev -p ${TEST_PORT}`,
    url: BASE_URL,
    // Don't reuse an existing server — it might have the real Supabase URL.
    reuseExistingServer: false,
    timeout: 120_000, // Next.js dev startup can take 30-60 s
    env: {
      // Use a separate .next-e2e distDir so this server never conflicts with
      // the local dev server's .next/dev/lock file.
      NEXT_E2E: "1",
      // Point both the browser client and the middleware at our mock Supabase.
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key",
      // 1-minute inactivity timeout: with a 2-minute warning lead-time the
      // warning modal appears immediately (on the first 1-second tick).
      NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES: "1",
    },
  },
});
