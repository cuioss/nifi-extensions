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

        const tokenInput = customUIFrame.locator(
            '[data-testid="token-input-area"]',
        );
        await expect(tokenInput).toBeVisible({ timeout: 5000 });

        await tokenInput.fill(CONSTANTS.TEST_TOKENS.VALID);
        processorLogger.info("Entered valid JWT token");

        const verifyButton = customUIFrame.locator(
            '[data-testid="verify-token-button"]',
        );
        await verifyButton.click();
        processorLogger.info("Clicked verify button");

        const successResult = customUIFrame.locator(
            '[data-testid="verification-success"]',
        );
        await expect(successResult).toBeVisible({ timeout: 10000 });
        processorLogger.info("✓ Token verified successfully");

        const tokenDetails = customUIFrame.locator(
            '[data-testid="token-details"]',
        );
        await expect(tokenDetails).toBeVisible({ timeout: 5000 });

        const detailSections = [
            { selector: '[data-testid="token-header"]', name: "Header" },
            { selector: '[data-testid="token-payload"]', name: "Payload" },
            {
                selector: '[data-testid="token-signature-status"]',
                name: "Signature Status",
            },
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

        const tokenInput = customUIFrame.locator(
            '[data-testid="token-input-area"]',
        );
        await tokenInput.fill(CONSTANTS.TEST_TOKENS.INVALID);
        processorLogger.info("Entered invalid JWT token");

        const verifyButton = customUIFrame.locator(
            '[data-testid="verify-token-button"]',
        );
        await verifyButton.click();
        processorLogger.info("Clicked verify button");

        const errorResult = customUIFrame.locator(
            '[data-testid="verification-error"]',
        );
        await expect(errorResult).toBeVisible({ timeout: 10000 });
        processorLogger.info("✓ Error result displayed");

        const errorMessage = customUIFrame.locator(
            '[data-testid="error-message"]',
        );
        await expect(errorMessage).toContainText(/invalid|malformed/i);
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

        const tokenInput = customUIFrame.locator(
            '[data-testid="token-input-area"]',
        );
        await tokenInput.fill(CONSTANTS.TEST_TOKENS.EXPIRED);
        processorLogger.info("Entered expired JWT token");

        const verifyButton = customUIFrame.locator(
            '[data-testid="verify-token-button"]',
        );
        await verifyButton.click();

        const expirationWarning = customUIFrame.locator(
            '[data-testid="token-expired-warning"]',
        );
        await expect(expirationWarning).toBeVisible({ timeout: 10000 });
        await expect(expirationWarning).toContainText(/expired/i);
        processorLogger.info("✓ Expiration warning displayed");

        const expirationDetails = customUIFrame.locator(
            '[data-testid="expiration-details"]',
        );
        await expect(expirationDetails).toBeVisible({ timeout: 5000 });
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

        const tokenInput = customUIFrame.locator(
            '[data-testid="token-input-area"]',
        );
        await tokenInput.fill(CONSTANTS.TEST_TOKENS.MALFORMED);

        const verifyButton = customUIFrame.locator(
            '[data-testid="verify-token-button"]',
        );
        await verifyButton.click();

        // Wait for verification to complete - either error or result panel will be visible
        await expect(
            customUIFrame
                .locator(
                    '[data-testid="verification-result-panel"], [data-testid="verification-error"], [data-testid="verification-success"]',
                )
                .first(),
        ).toBeVisible({ timeout: 5000 });

        const clearButton = customUIFrame.locator(
            '[data-testid="clear-token-button"]',
        );
        await expect(clearButton).toBeVisible({ timeout: 5000 });
        await clearButton.click();
        processorLogger.info("Clicked clear button");

        await expect(tokenInput).toHaveValue("");
        processorLogger.info("✓ Token input cleared");

        const resultPanel = customUIFrame.locator(
            '[data-testid="verification-result-panel"]',
        );
        await expect(resultPanel).not.toContainText(/success|error|expired/i);
        processorLogger.success("Token and results cleared successfully");
    });
});
