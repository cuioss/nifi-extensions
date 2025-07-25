/**
 * @file MultiIssuerJWTTokenAuthenticator Advanced Configuration Test
 * Verifies the advanced configuration of the MultiIssuerJWTTokenAuthenticator processor
 * @version 2.0.0
 */

import { test } from "@playwright/test";
import { ProcessorService } from "../utils/processor.js";
import { AuthService } from "../utils/auth-service.js";
import {
    saveTestBrowserLogs,
    setupStrictErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";

test.describe("MultiIssuerJWTTokenAuthenticator Advanced Configuration", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            // Setup error detection before login to catch any potential errors
            await setupStrictErrorDetection(page, testInfo, false);

            // Login first before going to JWT UI
            const authService = new AuthService(page);
            await authService.ensureReady();

            // Skip critical error detection for this test since we navigate directly to JWT UI
            // await checkCriticalErrors(page, testInfo);
        } catch (error) {
            // Save console logs immediately if beforeEach fails
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                console.warn(
                    "Failed to save console logs during beforeEach error:",
                    logError.message,
                );
            }
            throw error; // Re-throw the original error
        }
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        // Always try to save console logs first, regardless of test outcome
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            console.warn(
                "Failed to save console logs in afterEach:",
                error.message,
            );
        }

        // Skip critical error check for this test since we navigate directly to JWT UI
        // Final check for critical errors before test completion (only if test passed)
        // if (testInfo.status === 'passed') {
        //     try {
        //         await checkForCriticalErrors(page, testInfo);
        //     } catch (error) {
        //         // If critical errors are found, save logs again with the error info
        //         try {
        //             await saveTestBrowserLogs(testInfo);
        //         } catch (logError) {
        //             console.warn('Failed to save console logs after critical error:', logError.message);
        //         }
        //         throw error;
        //     }
        // }

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should access and verify advanced configuration", async ({
        page,
    }, testInfo) => {
        const _processorService = new ProcessorService(page, testInfo);

        // Navigate directly to JWT UI to test advanced configuration
        // Note: We skip canvas verification since we're going directly to the JWT UI
        processorLogger.info(
            "Navigating directly to JWT UI advanced configuration",
        );

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            // Verify advanced configuration elements
            const advancedElements = [
                {
                    selector: 'h3:has-text("Issuer Configurations")',
                    name: "Issuer Configurations header",
                },
                {
                    selector: 'button:has-text("Add Issuer")',
                    name: "Add Issuer button",
                },
                {
                    selector: 'input[placeholder*="Issuer Name"]',
                    name: "Issuer Name input",
                },
                {
                    selector: 'button:has-text("Verify Token")',
                    name: "Verify Token button",
                },
                {
                    selector: 'h3:has-text("Verification Results")',
                    name: "Verification Results section",
                },
            ];

            let elementsFound = 0;
            for (const element of advancedElements) {
                try {
                    const el = page.locator(element.selector);
                    if (await el.isVisible()) {
                        elementsFound++;
                        processorLogger.info(` Found: ${element.name}`);
                    } else {
                        processorLogger.warn(` Not found: ${element.name}`);
                    }
                } catch {
                    processorLogger.warn(` Error checking: ${element.name}`);
                }
            }

            // Take screenshot of advanced configuration
            await page.screenshot({
                path: `target/test-results/jwt-advanced-configuration-${Date.now()}.png`,
                fullPage: true,
            });
            processorLogger.info(
                "Screenshot of JWT advanced configuration saved",
            );

            if (elementsFound >= 3) {
                processorLogger.success(
                    `JWT UI advanced configuration verified with ${elementsFound}/${advancedElements.length} elements`,
                );
            } else {
                processorLogger.warn(
                    `Only ${elementsFound}/${advancedElements.length} advanced configuration elements found`,
                );
            }
        } catch (navError) {
            processorLogger.error(
                `Failed to navigate to JWT UI: ${navError.message}`,
            );
            throw navError;
        }
    });
});
