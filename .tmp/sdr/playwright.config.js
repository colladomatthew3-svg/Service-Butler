"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
exports.default = (0, test_1.defineConfig)({
    testDir: "./tests",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:3100",
        headless: true,
        trace: "on-first-retry"
    },
    webServer: {
        command: "DEMO_MODE=true ALLOW_NON_DEV_DEMO_MODE=true npm run build && DEMO_MODE=true ALLOW_NON_DEV_DEMO_MODE=true npm run start -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        timeout: 120000
    },
    projects: [
        {
            name: "chromium",
            use: { ...test_1.devices["Desktop Chrome"] }
        }
    ]
});
