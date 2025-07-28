/* eslint-disable no-console */
import { test } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import {
    setupAuthAwareErrorDetection,
    saveTestBrowserLogs,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";

test.describe("Simple Tab Content Check", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            await setupAuthAwareErrorDetection(page, testInfo);
            const authService = new AuthService(page);
            await authService.ensureReady();
        } catch (error) {
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                console.log(
                    `Failed to save console logs during beforeEach error: ${logError.message}`,
                );
            }
            throw error;
        }
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            console.log(
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }
        cleanupCriticalErrorDetection();
    });

    test("check all tab content", async ({ page }, testInfo) => {
        console.log("Starting simple tab content check");

        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Check each tab
        const tabs = [
            {
                name: "Configuration",
                pane: "#issuer-config",
            },
            {
                name: "Token Verification",
                pane: "#token-verification",
            },
            {
                name: "Metrics",
                pane: "#metrics",
            },
            {
                name: "Help",
                pane: "#help",
            },
        ];

        for (const tab of tabs) {
            console.log(`\n=== Checking ${tab.name} tab ===`);

            // Click the tab using ProcessorService
            await processorService.clickTab(customUIFrame, tab.name);
            await page.waitForTimeout(1000);

            // Get content from iframe context
            const content = await customUIFrame.locator(tab.pane).textContent();
            const html = await customUIFrame.locator(tab.pane).innerHTML();

            console.log(
                `${tab.name} content length: ${content?.length || 0} chars`,
            );
            console.log(`${tab.name} HTML length: ${html?.length || 0} chars`);

            if (!content || content.length < 50) {
                console.log(
                    `${tab.name} appears empty! Content: "${content || "null"}"`,
                );
                console.log(
                    `${tab.name} HTML preview: ${html?.substring(0, 200) || "null"}`,
                );
            } else {
                console.log(
                    `${tab.name} has content: ${content.substring(0, 100)}...`,
                );
            }

            // Take screenshot
            await page.screenshot({
                path: `target/test-results/simple-tab-${tab.name.toLowerCase().replace(" ", "-")}.png`,
                fullPage: true,
            });
        }
    });
});
