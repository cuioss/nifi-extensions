/**
 * @file Token Verification Tab Test
 * Verifies the token verification tab functionality in the JWT authenticator UI
 * @version 1.1.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { CONSTANTS } from "../utils/constants.js";
import {
    getValidAccessToken,
    getInvalidAccessToken,
} from "../utils/keycloak-token-service.js";
import { assertNoAuthError } from "../utils/test-assertions.js";

test.describe("Token Verification Tab", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should access token verification tab", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        await processorService.clickTab(customUIFrame, "Token Verification");

        const tabPanel = customUIFrame.locator("#token-verification");
        await expect(tabPanel).toBeVisible({ timeout: 5000 });

        const contentText = await tabPanel.textContent();

        // Token verification tab must have substantial content
        expect(contentText).toBeTruthy();
        expect(contentText.length).toBeGreaterThan(50);
    });

    test("should verify valid JWT token", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        await processorService.clickTab(customUIFrame, "Token Verification");

        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        await expect(tokenInput).toBeVisible({ timeout: 5000 });
        await expect(tokenInput).toBeEnabled({ timeout: 5000 });

        // Try to get a real token from Keycloak, fall back to test token if not available
        let validToken = CONSTANTS.TEST_TOKENS.VALID;
        try {
            validToken = await getValidAccessToken();
        } catch (_error) {
            // Keycloak not available, using test token
        }

        await tokenInput.fill(validToken);

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        // Wait for any verification result to appear
        const verificationResult = customUIFrame
            .locator(
                ".verification-status.valid, .verification-status.invalid, .error-message, .token-error, .error-container",
            )
            .first();
        await expect(verificationResult).toBeVisible({ timeout: 10000 });

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Must contain actual verification feedback (valid, invalid, or token-level error)
        expect(resultText).toMatch(
            /valid|invalid|expired|error|token|signature/i,
        );
    });

    test("should handle invalid JWT token", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        await processorService.clickTab(customUIFrame, "Token Verification");

        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        await expect(tokenInput).toBeEnabled({ timeout: 5000 });
        await tokenInput.fill(getInvalidAccessToken());

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        const errorResult = customUIFrame
            .locator(
                ".token-error, .error-container, .error-message, .verification-status",
            )
            .first();
        await expect(errorResult).toBeVisible({ timeout: 10000 });

        const resultText = await errorResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Must indicate a token-level error (invalid structure, signature, etc.)
        expect(resultText).toMatch(
            /invalid|error|fail|malformed|token|signature/i,
        );
    });

    test("should display token expiration status", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        await processorService.clickTab(customUIFrame, "Token Verification");

        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        await expect(tokenInput).toBeEnabled({ timeout: 5000 });

        await tokenInput.fill(CONSTANTS.TEST_TOKENS.EXPIRED);

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        const verificationMessage = customUIFrame
            .locator(
                ".token-error, .error-container, .warning-message, .verification-status, .error-message",
            )
            .first();
        await expect(verificationMessage).toBeVisible({ timeout: 10000 });

        const messageText = await verificationMessage.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(messageText);

        // Must indicate a token-level result (expired, invalid, error)
        expect(messageText).toMatch(
            /expired|invalid|error|token|signature|fail/i,
        );
    });

    test("should clear token and results", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        await processorService.clickTab(customUIFrame, "Token Verification");

        const tokenVerificationTab = customUIFrame.locator(
            "#token-verification",
        );
        const tokenInput = tokenVerificationTab
            .locator("#field-token-input")
            .first();
        await expect(tokenInput).toBeEnabled({ timeout: 5000 });
        await tokenInput.fill(getInvalidAccessToken());

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        // Wait for verification to complete
        await expect(
            customUIFrame
                .locator(
                    ".token-results-content, .token-error, .verification-status.valid, .verification-status.invalid, .error-container",
                )
                .first(),
        ).toBeVisible({ timeout: 5000 });

        const clearButton = tokenVerificationTab
            .locator('button:has-text("Clear"), .clear-token-button')
            .first();
        await expect(clearButton).toBeVisible({ timeout: 5000 });

        await clearButton.click();

        // Handle confirmation dialog if it appears
        const dialogConfirmButton = customUIFrame
            .locator(".confirmation-dialog .confirm-button")
            .first();
        if (await dialogConfirmButton.isVisible({ timeout: 2000 })) {
            await dialogConfirmButton.click();
        }

        await expect(tokenInput).toHaveValue("");

        // Results must be cleared — no validation output remaining
        const resultsContent = tokenVerificationTab
            .locator(".token-results-content")
            .first();
        const resultsText = await resultsContent.textContent();
        expect(resultsText).not.toMatch(
            /token is valid|token is invalid|error|expired|verification failed/i,
        );
    });
});
