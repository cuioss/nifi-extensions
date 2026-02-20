/**
 * @file Token Verification Tab Test
 * Verifies the token verification tab functionality in the JWT authenticator UI.
 *
 * The processor MUST have issuer configurations in the E2E environment.
 * Tests assert that actual token verification works end-to-end:
 * valid tokens produce "valid" results, invalid tokens produce token-level errors.
 * Infrastructure errors like "Service not available" are treated as test failures.
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
    getOtherRealmAccessToken,
    getLimitedUserAccessToken,
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

    test("should submit valid JWT token from Keycloak and show result", async ({
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
        await expect(tokenInput).toBeVisible({ timeout: 5000 });
        await expect(tokenInput).toBeEnabled({ timeout: 5000 });

        // Always fetch a real token from Keycloak — if Keycloak is unavailable, the test should fail
        const validToken = await getValidAccessToken();

        await tokenInput.fill(validToken);

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        // Wait for a positive verification result — a valid Keycloak token must succeed
        const verificationResult = customUIFrame
            .locator(".verification-status.valid")
            .first();
        await expect(verificationResult).toBeVisible({ timeout: 10000 });

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Must indicate a successful validation outcome
        expect(resultText).toMatch(/valid/i);

        // Verify decoded token details are rendered
        const tokenDetails = customUIFrame.locator(".token-details").first();
        await expect(tokenDetails).toBeVisible({ timeout: 5000 });

        // Header and Payload sections must be present
        const sectionHeaders = customUIFrame.locator(".token-section h4");
        await expect(sectionHeaders.filter({ hasText: "Header" })).toBeVisible({ timeout: 5000 });
        await expect(sectionHeaders.filter({ hasText: "Payload" })).toBeVisible({ timeout: 5000 });

        // Verify decoded Header contains "alg" (always present in JWT headers)
        const headerPre = customUIFrame.locator(".token-section:has(h4:has-text('Header')) pre").first();
        await expect(headerPre).toContainText('"alg"');

        // Verify decoded Payload contains standard claims
        const payloadPre = customUIFrame.locator(".token-section:has(h4:has-text('Payload')) pre").first();
        await expect(payloadPre).toContainText('"sub"');
        await expect(payloadPre).toContainText('"iss"');

        // Verify issuer claim references the Keycloak realm
        await expect(payloadPre).toContainText("oauth_integration_tests");

        // Token claims must include Issuer and Subject
        const tokenClaims = customUIFrame.locator(".token-claims").first();
        await expect(tokenClaims).toBeVisible({ timeout: 5000 });
        await expect(tokenClaims).toContainText("Issuer:");
        await expect(tokenClaims).toContainText("Subject:");
    });

    test("should reject invalid JWT token", async ({ page }, testInfo) => {
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

        // Must indicate a token-level error (not a service/infrastructure error)
        expect(resultText).toMatch(
            /invalid|error|fail|malformed|signature/i,
        );

        // Must NOT show a successful "valid token" message
        const validStatusVisible = await customUIFrame
            .locator(".verification-status.valid")
            .isVisible()
            .catch(() => false);
        expect(validStatusVisible).toBe(false);
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

        // Must indicate a token-level error (expired or invalid — the backend may not
        // distinguish between expiration and other validation failures)
        expect(messageText).toMatch(/expired|invalid/i);

        // Must NOT show a successful "valid token" message
        const validStatusVisible = await customUIFrame
            .locator(".verification-status.valid")
            .isVisible()
            .catch(() => false);
        expect(validStatusVisible).toBe(false);
    });

    test("should handle malformed token", async ({ page }, testInfo) => {
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

        await tokenInput.fill(CONSTANTS.TEST_TOKENS.MALFORMED);

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

        // Must indicate a token-level error — not even a valid JWT structure
        expect(resultText).toMatch(
            /invalid|error|fail|malformed|not.*jwt/i,
        );

        // Must NOT show a successful "valid token" message
        const validStatusVisible = await customUIFrame
            .locator(".verification-status.valid")
            .isVisible()
            .catch(() => false);
        expect(validStatusVisible).toBe(false);
    });

    test("should reject empty token submission", async ({ page }, testInfo) => {
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

        // Leave token input empty and click verify
        await tokenInput.fill("");

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        // Expect an error or validation message — empty input should not silently succeed
        const errorResult = customUIFrame
            .locator(
                ".token-error, .error-container, .error-message, .verification-status, .validation-message",
            )
            .first();
        await expect(errorResult).toBeVisible({ timeout: 10000 });

        const resultText = await errorResult.textContent();

        // Must indicate an error (empty/missing/required/invalid token)
        expect(resultText).toMatch(
            /empty|required|missing|invalid|error|enter.*token|provide.*token/i,
        );

        // Must NOT show a successful "valid token" message
        const validStatusVisible = await customUIFrame
            .locator(".verification-status.valid")
            .isVisible()
            .catch(() => false);
        expect(validStatusVisible).toBe(false);
    });

    test("should reject token from unconfigured issuer", async ({
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
        await expect(tokenInput).toBeVisible({ timeout: 5000 });
        await expect(tokenInput).toBeEnabled({ timeout: 5000 });

        // Fetch a real token from other_realm — valid JWT but from a different issuer
        const otherRealmToken = await getOtherRealmAccessToken();

        await tokenInput.fill(otherRealmToken);

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        // The processor is configured for oauth_integration_tests, so a token
        // from other_realm must be rejected (wrong issuer / unknown signing key)
        const errorResult = customUIFrame
            .locator(
                ".token-error, .error-container, .error-message, .verification-status",
            )
            .first();
        await expect(errorResult).toBeVisible({ timeout: 10000 });

        const resultText = await errorResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Must indicate a token-level error (issuer mismatch or signature failure)
        expect(resultText).toMatch(
            /invalid|error|fail|issuer|signature|unknown/i,
        );

        // Must NOT show a successful "valid token" message
        const validStatusVisible = await customUIFrame
            .locator(".verification-status.valid")
            .isVisible()
            .catch(() => false);
        expect(validStatusVisible).toBe(false);
    });

    test("should verify limitedUser token and show restricted role claims", async ({
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
        await expect(tokenInput).toBeVisible({ timeout: 5000 });
        await expect(tokenInput).toBeEnabled({ timeout: 5000 });

        // Fetch a real token for limitedUser — valid JWT from correct issuer/realm
        // but with only the 'user' role (missing the 'read' role)
        const limitedToken = await getLimitedUserAccessToken();

        await tokenInput.fill(limitedToken);

        const verifyButton = tokenVerificationTab
            .locator(".verify-token-button")
            .first();
        await verifyButton.click();

        // Token verification tab validates crypto/issuer only — the limitedUser
        // token is from the correct issuer, so it should be accepted as valid
        const verificationResult = customUIFrame
            .locator(".verification-status.valid")
            .first();
        await expect(verificationResult).toBeVisible({ timeout: 10000 });

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Must indicate a successful validation outcome
        expect(resultText).toMatch(/valid/i);

        // Verify decoded token details are rendered
        const tokenDetails = customUIFrame.locator(".token-details").first();
        await expect(tokenDetails).toBeVisible({ timeout: 5000 });

        // Verify decoded Payload contains the limitedUser's subject
        const payloadPre = customUIFrame.locator(".token-section:has(h4:has-text('Payload')) pre").first();
        await expect(payloadPre).toContainText('"sub"');

        // Verify issuer claim references the Keycloak realm
        await expect(payloadPre).toContainText("oauth_integration_tests");
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
