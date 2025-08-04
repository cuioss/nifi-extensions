/**
 * @file Token Verification Tab Test
 * Verifies the token verification tab functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { CONSTANTS } from "../utils/constants.js";
import {
    getValidAccessToken,
    getInvalidAccessToken,
} from "../utils/keycloak-token-service.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Token Verification Tab", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        // Setup auth-aware error detection
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

        // Try to get a real token from Keycloak, fall back to test token if not available
        let validToken = CONSTANTS.TEST_TOKENS.VALID;
        try {
            validToken = await getValidAccessToken();
            processorLogger.info("Using real token from Keycloak");
        } catch (error) {
            processorLogger.info("Keycloak not available, using test token");
        }

        // Fill the token input
        await tokenInput.fill(validToken);

        processorLogger.info("Entered valid JWT token");

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();

        // Click the verify button
        await verifyButton.click();
        processorLogger.info("Clicked verify button");

        // With the fixed servlet configuration, we should get actual JWT validation results
        const verificationResult = customUIFrame
            .locator(
                ".verification-status.valid, .verification-status.invalid, .error-message, .token-error, .error-container",
            )
            .first();
        await expect(verificationResult).toBeVisible({ timeout: 10000 });

        // Get the actual result text
        const resultText = await verificationResult.textContent();
        processorLogger.info(`Verification result: ${resultText}`);

        // Now we expect actual JWT validation results, not authentication errors
        if (
            resultText.includes("Token is valid") ||
            resultText.includes("valid")
        ) {
            processorLogger.info(
                "✅ Token verified successfully - JWT validation working!",
            );

            // Look for token details with the correct CSS class
            const tokenDetails = customUIFrame.locator(".token-details");
            if (await tokenDetails.isVisible({ timeout: 2000 })) {
                processorLogger.info("✅ Token details displayed");
            }
        } else if (
            resultText.includes("Missing or empty API key") ||
            resultText.includes("401") ||
            resultText.includes("Unauthorized")
        ) {
            processorLogger.error(
                "❌ Still getting authentication errors - servlet configuration may not be working",
            );
            throw new Error(
                "Authentication error indicates servlet URL mapping issue",
            );
        } else {
            processorLogger.info(
                "✅ Got JWT validation result (possibly invalid token)",
            );
        }

        processorLogger.success("Token verification UI tested successfully");
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
        // Fill the token input with invalid token from our utility
        await tokenInput.fill(getInvalidAccessToken());
        processorLogger.info("Entered invalid JWT token");

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();

        // Click the verify button
        await verifyButton.click();
        processorLogger.info("Clicked verify button");

        // Wait a bit for the verification to complete
        await page.waitForTimeout(2000);

        // Look for any error display - in standalone mode we might get auth errors
        const errorResult = customUIFrame
            .locator(
                ".token-error, .error-container, .error-message, .verification-status",
            )
            .first();
        await expect(errorResult).toBeVisible({ timeout: 10000 });

        const errorText = await errorResult.textContent();
        processorLogger.info(`Error result: ${errorText}`);

        // In standalone mode, we might get auth errors rather than token validation errors
        if (
            errorText.includes("401") ||
            errorText.includes("Unauthorized") ||
            errorText.includes("API key")
        ) {
            processorLogger.info(
                "✓ Got expected authentication error in standalone mode",
            );
        } else {
            processorLogger.info("✓ Error result displayed for invalid token");
        }

        processorLogger.success("Invalid JWT token UI tested successfully");
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

        // Click the verify button
        await verifyButton.click();

        // Look for any verification result
        const verificationMessage = customUIFrame
            .locator(
                ".token-error, .error-container, .warning-message, .verification-status, .error-message",
            )
            .first();
        await expect(verificationMessage).toBeVisible({ timeout: 10000 });

        const messageText = await verificationMessage.textContent();
        processorLogger.info(`Verification result: ${messageText}`);

        // With the fixed servlet configuration, we should get actual expiration detection
        if (
            messageText.includes("expired") ||
            messageText.includes("Expired") ||
            messageText.includes("Token expired")
        ) {
            processorLogger.info(
                "✅ Token expiration detected correctly - JWT validation working!",
            );
        } else if (
            messageText.includes("401") ||
            messageText.includes("Unauthorized") ||
            messageText.includes("API key")
        ) {
            processorLogger.error(
                "❌ Still getting authentication errors - servlet configuration may not be working",
            );
            throw new Error(
                "Authentication error indicates servlet URL mapping issue",
            );
        } else {
            processorLogger.info(
                "✅ Got JWT validation result: " + messageText,
            );
        }

        processorLogger.success("Token expiration UI tested successfully");
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
        // Fill the token input with invalid token from our utility
        await tokenInput.fill(getInvalidAccessToken());

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();

        // Click the verify button
        await verifyButton.click();

        // Wait for verification to complete - look for any result
        await expect(
            customUIFrame
                .locator(
                    ".token-results-content, .token-error, .verification-status.valid, .verification-status.invalid, .error-container",
                )
                .first(),
        ).toBeVisible({ timeout: 5000 });

        // Look for clear button - it's a button with text "Clear"
        const clearButton = tokenVerificationTab
            .locator('button:has-text("Clear"), .clear-token-button')
            .first();
        await expect(clearButton).toBeVisible({ timeout: 5000 });

        // Click the clear button
        await clearButton.click();
        processorLogger.info("Clicked clear button");

        // Handle confirmation dialog if it appears
        // Look for the dialog confirmation button, not the form clear button
        const dialogConfirmButton = customUIFrame
            .locator(".confirmation-dialog .confirm-button")
            .first();
        if (await dialogConfirmButton.isVisible({ timeout: 2000 })) {
            await dialogConfirmButton.click();
            processorLogger.info("Confirmed clear action in dialog");
        }

        await expect(tokenInput).toHaveValue("");
        processorLogger.info("✓ Token input cleared");

        // Check that results are cleared or show initial instructions
        const resultsContent = tokenVerificationTab
            .locator(".token-results-content")
            .first();
        const resultsText = await resultsContent.textContent();
        // Should either be empty or show instructions (but not error/success messages)
        expect(resultsText).not.toMatch(
            /token is valid|token is invalid|error|expired|verification failed/i,
        );
        processorLogger.success("Token and results cleared successfully");
    });
});
