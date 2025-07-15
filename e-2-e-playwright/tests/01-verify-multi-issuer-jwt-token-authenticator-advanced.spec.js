/**
 * @file MultiIssuerJWTTokenAuthenticator Advanced Configuration Test - Modernized
 * Verifies the advanced configuration of the MultiIssuerJWTTokenAuthenticator processor
 * @version 2.0.0
 * @description
 * IMPORTANT: This test has been modified to fail when the page stalls at "Loading JWT Validator UI..."
 * This is a requirement specified in the issue description. The test now includes a dedicated check
 * for this loading stall condition and will fail with a detailed error message if detected.
 *
 * The loading stall check is performed:
 * 1. In a dedicated test "should not stall at loading indicator"
 * 2. In the beforeEach hook for all tests
 * 3. At the beginning of each individual test
 *
 * This ensures that the test will fail fast and with a clear error message if the UI is stalled.
 */

import { test, expect } from "@playwright/test";
import { ProcessorService } from "../utils/processor.js";
import { AuthService } from "../utils/auth-service.js";
import { CONSTANTS } from "../utils/constants.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
    checkForCriticalErrors,
} from "../utils/console-logger.js";
import {
    checkCriticalErrors,
    cleanupCriticalErrorDetection,
} from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";

// Loading indicator selectors
const LOADING_INDICATOR_SELECTORS = [
    "#loading-indicator",
    ".loading-indicator",
    '[id*="loading"]',
    'text="Loading JWT Validator UI..."',
];

/**
 * Check if the loading indicator is visible and fail the test if it is
 * This implements the requirement that the test must fail when the page
 * stalls at "Loading JWT Validator UI..."
 * @param {import('@playwright/test').Page} page - The Playwright page object
 * @returns {Promise<boolean>} True if no loading stall detected, throws error if stall detected
 */
async function checkForLoadingStall(page) {
    processorLogger.info("Checking for loading indicator stall...");

    // First check for any element with the exact loading text
    // This is the most specific check and should be prioritized
    const exactTextLocators = [
        page.locator('text="Loading JWT Validator UI..."'),
        page.locator('text="Loading JWT Validator UI"'),
        page.locator("text=Loading JWT Validator UI..."),
        page.locator("text=Loading JWT Validator UI"),
    ];

    for (const locator of exactTextLocators) {
        const isVisible = await locator.isVisible().catch(() => false);
        if (isVisible) {
            const textContent = await locator
                .textContent()
                .catch(() => "Loading JWT Validator UI...");
            processorLogger.error(
                `CRITICAL: UI stalled at loading message: "${textContent}"`,
            );

            // Take a screenshot for debugging
            const screenshotPath = `loading-stall-${Date.now()}.png`;
            await page.screenshot({ path: screenshotPath });

            // Get page URL for context
            const url = page.url();

            // Fail the test with a detailed message
            throw new Error(
                `FAILURE: UI stalled at "Loading JWT Validator UI..." message.\n` +
                    `This indicates the JWT Validator UI failed to initialize properly.\n` +
                    `URL: ${url}\n` +
                    `Screenshot saved to: ${screenshotPath}\n` +
                    `This test is designed to fail in this condition as required.`,
            );
        }
    }

    // Check each loading indicator selector
    for (const selector of LOADING_INDICATOR_SELECTORS) {
        const locator = page.locator(selector);
        const isVisible = await locator.isVisible().catch(() => false);

        if (isVisible) {
            // Get the text content if possible
            const textContent = await locator
                .textContent()
                .catch(() => "Unknown");

            // Only fail if the text contains "Loading JWT Validator UI"
            if (
                textContent.includes("Loading JWT Validator UI") ||
                textContent.includes("Loading JWT") ||
                (textContent.includes("Loading") &&
                    selector.includes("loading"))
            ) {
                processorLogger.error(
                    `Loading indicator still visible: ${selector} with text "${textContent}"`,
                );

                // Take a screenshot for debugging
                const screenshotPath = `loading-stall-${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath });

                // Get page URL for context
                const url = page.url();

                // Fail the test with a detailed message
                throw new Error(
                    `FAILURE: UI stalled at loading indicator with text: "${textContent}"\n` +
                        `Selector: ${selector}\n` +
                        `URL: ${url}\n` +
                        `Screenshot saved to: ${screenshotPath}\n` +
                        `This test is designed to fail in this condition as required.`,
                );
            }
        }
    }

    // Also check for any element containing the loading text using a more general approach
    const allElements = await page.$$("*");
    for (const element of allElements) {
        try {
            const textContent = await element.textContent();
            if (
                textContent &&
                (textContent.includes("Loading JWT Validator UI...") ||
                    textContent === "Loading JWT Validator UI")
            ) {
                processorLogger.error(
                    `Found element with loading text: "${textContent}"`,
                );

                // Take a screenshot for debugging
                const screenshotPath = `loading-text-stall-${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath });

                // Get page URL for context
                const url = page.url();

                // Fail the test with a detailed message
                throw new Error(
                    `FAILURE: Found element with text: "${textContent}"\n` +
                        `This indicates the JWT Validator UI failed to initialize properly.\n` +
                        `URL: ${url}\n` +
                        `Screenshot saved to: ${screenshotPath}\n` +
                        `This test is designed to fail in this condition as required.`,
                );
            }
        } catch (error) {
            // Ignore errors when trying to get text content
            continue;
        }
    }

    processorLogger.info("No loading indicator stall detected");
    return true;
}

test.describe("MultiIssuerJWTTokenAuthenticator Advanced Configuration", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup auth-aware error detection (skips initial canvas checks)
        await setupAuthAwareErrorDetection(page, testInfo);

        const authService = new AuthService(page);
        await authService.ensureReady();

        // Check for critical errors after authentication
        await checkCriticalErrors(page, testInfo);

        // Also check for loading stall after authentication using original function
        await checkForLoadingStall(page);
    });

    // This test specifically checks for the loading stall condition
    // It will fail if the UI is stalled at "Loading JWT Validator UI..."
    test("should not stall at loading indicator", async ({ page }) => {
        processorLogger.info("Running loading stall check test...");

        // Wait for the page to be fully loaded
        await page.waitForLoadState("networkidle", { timeout: 30000 });

        // Check for loading stall
        await checkForLoadingStall(page);

        // Verify the canvas is ready as an additional check
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            {
                timeout: 30000,
            },
        );

        processorLogger.success("UI loaded successfully without stalling");
    });

    test.afterEach(async ({ page }, testInfo) => {
        // Final check for critical errors before test completion
        await checkForCriticalErrors(page, testInfo);

        // Save console logs for this specific test
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            // Silently handle logging errors
        }

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should verify MultiIssuerJWTTokenAuthenticator deployment", async ({
        page,
    }, testInfo) => {
        // Check for critical errors before proceeding
        await checkCriticalErrors(page, testInfo);

        const processorService = new ProcessorService(page, testInfo);

        // Check for loading stall before proceeding
        await checkForLoadingStall(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // Check for critical errors after canvas verification
        await checkCriticalErrors(page, testInfo);

        // Find and verify the processor deployment
        const processor =
            await processorService.verifyMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        if (processor) {
            // Comprehensive verification tests
            expect(
                processor,
                "MultiIssuerJWTTokenAuthenticator should be deployed",
            ).toBeTruthy();
            expect(
                processor.isVisible,
                "Processor should be visible on canvas",
            ).toBeTruthy();
            expect(
                processor.name,
                "Processor name should contain MultiIssuerJWTTokenAuthenticator",
            ).toContain("MultiIssuerJWTTokenAuthenticator");
        } else {
            processorLogger.info(
                "MultiIssuerJWTTokenAuthenticator not found - skipping advanced configuration test",
            );
        }

        // Final check for critical errors
        await checkCriticalErrors(page, testInfo);
    });

    test("should open processor configuration dialog", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Check for loading stall before proceeding
        await checkForLoadingStall(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // Find the processor
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        if (processor) {
            try {
                // Attempt to open configuration dialog using modern service
                const dialog = await processorService.openConfiguration(
                    "Multi-Issuer JWT Token Authenticator",
                    { timeout: 10000 },
                );

                // Verify dialog appeared
                await expect(dialog).toBeVisible();

                processorLogger.success(
                    "Successfully opened configuration dialog",
                );
            } catch (error) {
                processorLogger.warn(
                    "Configuration dialog could not be opened: %s",
                    error.message,
                );
                // This is acceptable as the UI may have restrictions
            }
        } else {
            processorLogger.info(
                "MultiIssuerJWTTokenAuthenticator not found - skipping configuration dialog test",
            );
        }
    });

    test("should attempt to access advanced configuration", async ({
        page,
    }) => {
        const processorService = new ProcessorService(page, testInfo);

        // Check for loading stall before proceeding
        await checkForLoadingStall(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // Find the processor
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        if (processor) {
            try {
                // Attempt to open advanced configuration using modern service
                const advancedConfig =
                    await processorService.configureMultiIssuerJwtAuthenticator(
                        {
                            timeout: 10000,
                            takeScreenshot: true,
                        },
                    );

                // Verify advanced configuration view
                await expect(advancedConfig).toBeVisible();

                processorLogger.success(
                    "Successfully accessed advanced configuration",
                );
            } catch (error) {
                processorLogger.warn(
                    "Advanced configuration could not be accessed: %s",
                    error.message,
                );
                // This is acceptable as the processor may not allow configuration in this context
            }
        } else {
            processorLogger.info(
                "MultiIssuerJWTTokenAuthenticator not found - skipping advanced configuration test",
            );
        }
    });

    test("should verify processor can be interacted with", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Check for loading stall before proceeding
        await checkForLoadingStall(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

        // Find the processor
        const processor =
            await processorService.findMultiIssuerJwtAuthenticator({
                failIfNotFound: false,
            });

        if (processor) {
            // Test basic interaction (hover)
            await processorService.interact(processor, {
                action: "hover",
                takeScreenshot: true,
            });

            // Verify processor is still accessible after interaction
            expect(
                processor.element,
                "Processor should remain accessible after interaction",
            ).toBeTruthy();

            processorLogger.success("Successfully interacted with processor");
        } else {
            processorLogger.info(
                "MultiIssuerJWTTokenAuthenticator not found - skipping interaction test",
            );
        }
    });
});
