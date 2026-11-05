import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ADA_TEST_MODE: "true",
      ADA_DEV_AUTH: "true",
      MOCK_MODEL: "true",
      APP_BASE_URL: "http://localhost:3000",
    },
  },
  reporter: "list",
});
