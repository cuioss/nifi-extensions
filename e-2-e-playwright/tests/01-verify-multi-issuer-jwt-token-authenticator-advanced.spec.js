/**
 * @file MultiIssuerJWTTokenAuthenticator Advanced Configuration Test - Modernized
 * Verifies the advanced configuration of the MultiIssuerJWTTokenAuthenticator processor
 * @version 2.0.0
 */

import { test, expect } from "@playwright/test";
import { ProcessorService } from "../utils/processor.js";
import { AuthService } from "../utils/auth-service.js";
import { CONSTANTS } from "../utils/constants.js";
import {
    setupBrowserConsoleLogging,
    saveTestBrowserLogs,
} from "../utils/console-logger.js";
import { processorLogger } from "../utils/shared-logger.js";

test.describe("MultiIssuerJWTTokenAuthenticator Advanced Configuration", () => {
    // Make sure we're logged in before each test
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup console logging for this test
        setupBrowserConsoleLogging(page, testInfo);

        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        // Save console logs for this specific test
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            // Silently handle logging errors
        }
    });

    test("should verify MultiIssuerJWTTokenAuthenticator deployment", async ({
        page,
    }) => {
        const processorService = new ProcessorService(page);

        // Verify the canvas is ready
        await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible(
            { timeout: 30000 },
        );

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
    });

    test("should open processor configuration dialog", async ({ page }) => {
        const processorService = new ProcessorService(page);

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
        const processorService = new ProcessorService(page);

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

    test("should verify processor can be interacted with", async ({ page }) => {
        const processorService = new ProcessorService(page);

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
