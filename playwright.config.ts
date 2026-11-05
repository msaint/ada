import { defineConfig } from "@playwright/test";
const port = Number(process.env.ADA_TEST_PORT || 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  use: { baseURL },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ADA_TEST_MODE: "true",
      ADA_DEV_AUTH: "true",
      MOCK_MODEL: "true",
      APP_BASE_URL: baseURL,
    },
  },
  reporter: "list",
});
