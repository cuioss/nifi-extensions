/**
 * @file Self-Test: Processor Navigation and Error Handling
 * Tests configuration dialog error handling
 * @version 1.2.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("Self-Test: Processor Navigation and Error Handling", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure processor is on canvas for all tests
        await processorManager.ensureProcessorOnCanvas();

        // Stop processor so configure option is available in context menu
        await processorManager.stopProcessor();

        // Don't check for critical errors here - authentication may have transient 401s
        await takeStartScreenshot(page, testInfo);
    });

    test("should handle configuration dialog failures gracefully", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Try to configure a non-existent processor
        const nonExistentProcessor = {
            element: '[data-nonexistent="true"]',
            locator: page.locator('[data-nonexistent="true"]'),
            type: "NonExistent",
            isVisible: false,
        };

        // Should handle gracefully without throwing
        await expect(async () => {
            await processorService.configure(nonExistentProcessor, {
                timeout: 2000,
            });
        }).rejects.toThrow(); // Should throw timeout error
    });
});
