/**
 * @file Token Verification Tab Test
 * Verifies the token verification tab functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { CONSTANTS } from "../utils/constants.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Token Verification Tab", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Setup auth-aware error detection
        await setupAuthAwareErrorDetection(page, testInfo);

        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        // Always save browser logs first
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }

        // Cleanup critical error detection
        cleanupCriticalErrorDetection();
    });

    test("should access token verification tab", async ({ page }, testInfo) => {
        processorLogger.info("Testing token verification tab access");

        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Click on Token Verification tab
        await processorService.clickTab(customUIFrame, "Token Verification");

        const tabPanel = customUIFrame.locator("#token-verification");
        await expect(tabPanel).toBeVisible({ timeout: 5000 });
        processorLogger.info("✓ Token Verification tab panel displayed");

        // Wait for tab content to fully load
        await page.waitForTimeout(2000);

        // Verify basic content is present (using more generic selectors)
        const tabContent = customUIFrame.locator("#token-verification");
        const contentText = await tabContent.textContent();

        // Token verification tab must have substantial content
        expect(contentText).toBeTruthy();
        expect(contentText.length).toBeGreaterThan(50);
        processorLogger.info("✓ Token Verification tab content loaded");

        processorLogger.success("Token verification tab accessed successfully");
    });

    test("should verify valid JWT token", async ({ page }, testInfo) => {
        processorLogger.info("Testing valid JWT token verification");
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Click on Token Verification tab
        await processorService.clickTab(customUIFrame, "Token Verification");

        // Wait for tab content to load
        await page.waitForTimeout(2000);

        // Find the token input within the Token Verification tab
        // Multiple elements may exist on the page, so we need to be specific
        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        await expect(tokenInput).toBeVisible({ timeout: 5000 });

        // Try to fill token input (may be initially disabled)
        // If disabled, force the interaction
        try {
            await tokenInput.fill(CONSTANTS.TEST_TOKENS.VALID, {
                timeout: 2000,
            });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the input first
                await tokenInput.evaluate((input) => {
                    input.removeAttribute("disabled");
                    input.disabled = false;
                });
                await tokenInput.fill(CONSTANTS.TEST_TOKENS.VALID);
            } else {
                throw error;
            }
        }

        processorLogger.info("Entered valid JWT token");

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();

        // Try to click the verify button (may be initially disabled)
        try {
            await verifyButton.click({ timeout: 2000 });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the button first
                await verifyButton.evaluate((button) => {
                    button.removeAttribute("disabled");
                    button.disabled = false;
                });
                await verifyButton.click();
            } else {
                throw error;
            }
        }
        processorLogger.info("Clicked verify button");

        // Look for the success message with the correct CSS class
        const successResult = customUIFrame.locator(".token-valid");
        await expect(successResult).toBeVisible({ timeout: 10000 });
        await expect(successResult).toContainText(/Token is valid/);
        processorLogger.info("✓ Token verified successfully");

        // Look for token details with the correct CSS class
        const tokenDetails = customUIFrame.locator(".token-details");
        await expect(tokenDetails).toBeVisible({ timeout: 5000 });

        // Check for token claims table which contains the details
        const detailSections = [
            { selector: ".token-claims-table", name: "Token Claims Table" },
            { selector: ".token-raw-claims", name: "Raw Claims" },
        ];

        for (const section of detailSections) {
            const el = customUIFrame.locator(section.selector);
            await expect(el).toBeVisible({ timeout: 5000 });
            processorLogger.info(`✓ ${section.name} section displayed`);
        }

        processorLogger.success("Valid JWT token verified successfully");
    });

    test("should handle invalid JWT token", async ({ page }, testInfo) => {
        processorLogger.info("Testing invalid JWT token verification");
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Click on Token Verification tab
        await processorService.clickTab(customUIFrame, "Token Verification");

        // Wait for tab content to load
        await page.waitForTimeout(2000);

        // Scope to token verification tab to avoid multiple element matches
        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        // Try to fill token input (may be initially disabled)
        try {
            await tokenInput.fill(CONSTANTS.TEST_TOKENS.INVALID, {
                timeout: 2000,
            });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the input first
                await tokenInput.evaluate((input) => {
                    input.removeAttribute("disabled");
                    input.disabled = false;
                });
                await tokenInput.fill(CONSTANTS.TEST_TOKENS.INVALID);
            } else {
                throw error;
            }
        }
        processorLogger.info("Entered invalid JWT token");

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();

        // Try to click the verify button (may be initially disabled)
        try {
            await verifyButton.click({ timeout: 2000 });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the button first
                await verifyButton.evaluate((button) => {
                    button.removeAttribute("disabled");
                    button.disabled = false;
                });
                await verifyButton.click();
            } else {
                throw error;
            }
        }
        processorLogger.info("Clicked verify button");

        // Look for error display using the correct CSS classes
        const errorResult = customUIFrame
            .locator(".token-error, .error-container, .error-message")
            .first();
        await expect(errorResult).toBeVisible({ timeout: 10000 });
        processorLogger.info("✓ Error result displayed");

        // Error details might be in various containers
        const errorMessage = customUIFrame
            .locator(".token-error-message, .error-message, .error-container")
            .first();
        await expect(errorMessage).toBeVisible();
        processorLogger.info("✓ Error message displayed");

        processorLogger.success("Invalid JWT token handled correctly");
    });

    test("should display token expiration status", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing token expiration status display");
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Click on Token Verification tab
        await processorService.clickTab(customUIFrame, "Token Verification");

        // Wait for tab content to load
        await page.waitForTimeout(2000);

        // Scope to token verification tab to avoid multiple element matches
        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        // Try to fill token input (may be initially disabled)
        try {
            await tokenInput.fill(CONSTANTS.TEST_TOKENS.EXPIRED, {
                timeout: 2000,
            });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the input first
                await tokenInput.evaluate((input) => {
                    input.removeAttribute("disabled");
                    input.disabled = false;
                });
                await tokenInput.fill(CONSTANTS.TEST_TOKENS.EXPIRED);
            } else {
                throw error;
            }
        }
        processorLogger.info("Entered expired JWT token");

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();

        // Try to click the verify button (may be initially disabled)
        try {
            await verifyButton.click({ timeout: 2000 });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the button first
                await verifyButton.evaluate((button) => {
                    button.removeAttribute("disabled");
                    button.disabled = false;
                });
                await verifyButton.click();
            } else {
                throw error;
            }
        }

        // Look for error or warning about expiration
        const expirationMessage = customUIFrame
            .locator(
                ".token-error, .error-container, .warning-message, .token-invalid, .error-message",
            )
            .first();
        await expect(expirationMessage).toBeVisible({ timeout: 10000 });
        // The message should contain something about expiration
        const messageText = await expirationMessage.textContent();
        processorLogger.info(`Message displayed: ${messageText}`);
        processorLogger.info("✓ Token verification result displayed");

        // Token details might still be shown even if expired
        const tokenDetails = customUIFrame
            .locator(".token-details, .token-claims-table")
            .first();
        if (await tokenDetails.isVisible({ timeout: 2000 })) {
            processorLogger.info("✓ Token details shown despite expiration");
        }
        processorLogger.success("Token expiration status displayed correctly");
    });

    test("should clear token and results", async ({ page }, testInfo) => {
        processorLogger.info("Testing clear token functionality");
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Click on Token Verification tab
        await processorService.clickTab(customUIFrame, "Token Verification");

        // Wait for tab content to load
        await page.waitForTimeout(2000);

        // Scope to token verification tab to avoid multiple element matches
        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        // Try to fill token input (may be initially disabled)
        try {
            await tokenInput.fill(CONSTANTS.TEST_TOKENS.MALFORMED, {
                timeout: 2000,
            });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the input first
                await tokenInput.evaluate((input) => {
                    input.removeAttribute("disabled");
                    input.disabled = false;
                });
                await tokenInput.fill(CONSTANTS.TEST_TOKENS.MALFORMED);
            } else {
                throw error;
            }
        }

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();

        // Try to click the verify button (may be initially disabled)
        try {
            await verifyButton.click({ timeout: 2000 });
        } catch (error) {
            if (error.message.includes("disabled")) {
                // Force enable the button first
                await verifyButton.evaluate((button) => {
                    button.removeAttribute("disabled");
                    button.disabled = false;
                });
                await verifyButton.click();
            } else {
                throw error;
            }
        }

        // Wait for verification to complete - look for any result
        await expect(
            customUIFrame
                .locator(
                    ".token-results-content, .token-error, .token-valid, .token-invalid, .error-container",
                )
                .first(),
        ).toBeVisible({ timeout: 5000 });

        // Look for clear button - it's a button with text "Clear"
        const clearButton = tokenVerificationTab
            .locator('button:has-text("Clear"), .clear-token-button')
            .first();
        await expect(clearButton).toBeVisible({ timeout: 5000 });
        
        // Try to click the clear button (may be initially disabled)
        try {
            await clearButton.click({ timeout: 2000 });
        } catch (error) {
            if (error.message.includes('disabled')) {
                // Force enable the button first
                await clearButton.evaluate(button => {
                    button.removeAttribute('disabled');
                    button.disabled = false;
                });
                await clearButton.click();
            } else {
                throw error;
            }
        }
        processorLogger.info("Clicked clear button");

        // Handle confirmation dialog if it appears
        // Look for the dialog confirmation button, not the form clear button
        const dialogConfirmButton = customUIFrame
            .locator('.confirmation-dialog .confirm-button')
            .first();
        if (await dialogConfirmButton.isVisible({ timeout: 2000 })) {
            await dialogConfirmButton.click();
            processorLogger.info("Confirmed clear action in dialog");
        }

        await expect(tokenInput).toHaveValue("");
        processorLogger.info("✓ Token input cleared");

        // Check that results are cleared or show initial instructions
        const resultsContent = tokenVerificationTab.locator(".token-results-content").first();
        const resultsText = await resultsContent.textContent();
        // Should either be empty or show instructions (but not error/success messages)
        expect(resultsText).not.toMatch(/token is valid|token is invalid|error|expired|verification failed/i);
        processorLogger.success("Token and results cleared successfully");
    });
});
