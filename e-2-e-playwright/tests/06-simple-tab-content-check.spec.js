import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { processorLogger } from "../utils/shared-logger.js";
import {
    setupAuthAwareErrorDetection,
    saveTestBrowserLogs,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";

test.describe("Simple Tab Content Check", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        try {
            await setupAuthAwareErrorDetection(page, testInfo);
            const authService = new AuthService(page);
            await authService.ensureReady();
        
        // Ensure processor is on canvas before each test
        processorLogger.info('Ensuring MultiIssuerJWTTokenAuthenticator is on canvas...');
        const ready = await processorManager.ensureProcessorOnCanvas();
        if (!ready) {
            throw new Error(
                'Cannot ensure MultiIssuerJWTTokenAuthenticator is on canvas. ' +
                'The processor must be deployed in NiFi for tests to run.'
            );
        }
        processorLogger.success('Processor is ready on canvas for test');
        } catch (error) {
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                processorLogger.warn(
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
            processorLogger.warn(
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }
        cleanupCriticalErrorDetection();
    });

    test("check all tab content", async ({ page }, testInfo) => {
        processorLogger.info("Starting simple tab content check");

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
            processorLogger.info(`Checking ${tab.name} tab`);

            // Click the tab using ProcessorService
            await processorService.clickTab(customUIFrame, tab.name);

            // Wait for tab content to be visible
            await expect(customUIFrame.locator(tab.pane)).toBeVisible({
                timeout: 5000,
            });

            // Get content from iframe context
            const content = await customUIFrame.locator(tab.pane).textContent();
            const html = await customUIFrame.locator(tab.pane).innerHTML();

            processorLogger.info(
                `${tab.name} content length: ${content?.length || 0} chars, HTML length: ${html?.length || 0} chars`,
            );

            // Assert that tab content meets minimum requirements
            expect(content).toBeTruthy();
            expect(html).toBeTruthy();

            // Each tab must have substantial content - strict requirements
            const minContentLength = {
                Configuration: 500, // Should have issuer form elements
                "Token Verification": 200, // Should have verification form
                Metrics: 500, // Should have actual metrics data (not error message)
                Help: 500, // Should have documentation
            };

            const expectedLength = minContentLength[tab.name];
            expect(content.length).toBeGreaterThan(
                expectedLength,
                `${tab.name} tab content too short: ${content.length} chars, expected > ${expectedLength}`,
            );

            // Verify tab has proper HTML structure with specific elements
            expect(html).toMatch(/<[^>]+>/); // Has HTML tags
            expect(html.length).toBeGreaterThan(
                expectedLength * 3,
                `${tab.name} tab HTML too short: ${html.length} chars`,
            );

            // Verify specific content per tab
            switch (tab.name) {
                case "Configuration":
                    expect(html).toContain("button");
                    expect(html).toContain("input");
                    break;
                case "Token Verification":
                    expect(html).toContain("button");
                    expect(html).toContain("textarea");
                    break;
                case "Metrics":
                    expect(html).toContain("data-testid");
                    break;
                case "Help":
                    expect(html).toContain("h");
                    break;
            }

            // Log success for debugging
            processorLogger.info(
                `✓ ${tab.name} tab has sufficient content (${content.length} chars)`,
            );

            // Take screenshot
            await page.screenshot({
                path: `${testInfo.outputDir}/simple-tab-${tab.name.toLowerCase().replace(" ", "-")}.png`,
                fullPage: true,
            });
        }
    });
});
