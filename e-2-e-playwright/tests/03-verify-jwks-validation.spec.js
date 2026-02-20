/**
 * @file JWKS Validation Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI.
 *
 * Note: SSRF protection blocks private/loopback addresses (including localhost),
 * so the real Keycloak JWKS URL cannot be validated through the UI. Instead,
 * we test that SSRF protection works correctly and that invalid URLs are rejected.
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { assertNoAuthError } from "../utils/test-assertions.js";

test.describe("JWKS Validation", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should block private/loopback JWKS URLs via SSRF protection", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        // First click "Add Issuer" to enable the form
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        const jwksUrlInput = customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        // Use localhost Keycloak JWKS URL — SSRF protection should block this
        await jwksUrlInput.fill(
            "http://localhost:9080/realms/oauth_integration_tests/protocol/openid-connect/certs",
        );

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for SSRF error
        await expect(verificationResult).toContainText(
            /private|loopback|address/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Must indicate SSRF block — not a generic error
        expect(resultText).toMatch(/private|loopback/i);

        // Must NOT show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should handle invalid JWKS URL", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        const jwksUrlInput = customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        await jwksUrlInput.fill("not-a-valid-url");

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for actual validation content (not just element visibility)
        await expect(verificationResult).toContainText(
            /error|invalid|fail/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Invalid URL must not show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should validate JWKS file path", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        // Switch JWKS Source Type to "File" to reveal the file path input
        const jwksTypeSelect = customUIFrame
            .locator('select[name="jwks-type"]')
            .first();
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("file");

        // Wait for the file input to become visible after type switch
        const jwksFileInput = customUIFrame
            .locator('input[name="jwks-file"]')
            .first();
        await expect(jwksFileInput).toBeVisible({ timeout: 5000 });
        await expect(jwksFileInput).toBeEnabled({ timeout: 5000 });

        await jwksFileInput.fill("/path/to/jwks.json");

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for actual validation content (not just element visibility)
        await expect(verificationResult).toContainText(
            /error|invalid|fail|not found/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // File path must not show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should toggle JWKS field visibility when switching source type", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        const jwksTypeSelect = customUIFrame
            .locator('select[name="jwks-type"]')
            .first();
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });

        const urlField = customUIFrame.locator(".jwks-type-url").first();
        const fileField = customUIFrame.locator(".jwks-type-file").first();
        const memoryField = customUIFrame.locator(".jwks-type-memory").first();

        // Default state: URL selected — URL field visible, file and memory hidden
        await expect(urlField).toBeVisible({ timeout: 5000 });
        await expect(fileField).toBeHidden();
        await expect(memoryField).toBeHidden();

        // Switch to "file" — file field visible, others hidden
        await jwksTypeSelect.selectOption("file");
        await expect(fileField).toBeVisible({ timeout: 5000 });
        await expect(urlField).toBeHidden();
        await expect(memoryField).toBeHidden();

        // Switch to "memory" — memory field visible, others hidden
        await jwksTypeSelect.selectOption("memory");
        await expect(memoryField).toBeVisible({ timeout: 5000 });
        await expect(urlField).toBeHidden();
        await expect(fileField).toBeHidden();

        // Switch back to "url" — original state restored
        await jwksTypeSelect.selectOption("url");
        await expect(urlField).toBeVisible({ timeout: 5000 });
        await expect(fileField).toBeHidden();
        await expect(memoryField).toBeHidden();
    });

    test("should accept valid JWKS inline content", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        // Switch JWKS Source Type to "Memory" to reveal the content textarea
        const jwksTypeSelect = customUIFrame
            .locator('select[name="jwks-type"]')
            .first();
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("memory");

        const jwksContentArea = customUIFrame
            .locator('textarea[name="jwks-content"]')
            .first();
        await expect(jwksContentArea).toBeVisible({ timeout: 5000 });
        await expect(jwksContentArea).toBeEnabled({ timeout: 5000 });

        // Fill with a valid JWKS structure containing an RSA public key
        const validJwks = JSON.stringify({
            keys: [
                {
                    kty: "RSA",
                    kid: "test-key-1",
                    use: "sig",
                    alg: "RS256",
                    n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
                    e: "AQAB",
                },
            ],
        });
        await jwksContentArea.fill(validJwks);

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for validation to complete — must contain actual result, not "Testing..."
        await expect(verificationResult).not.toContainText("Testing", { timeout: 30000 });

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Valid JWKS content should show as success (OK, valid, key found)
        expect(resultText).toMatch(/OK|valid|success|key/i);
    });

    test("should reject invalid JWKS inline content", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);
        expect(advancedOpened).toBe(true);

        const customUIFrame = await processorService.getAdvancedUIFrame();
        expect(customUIFrame).toBeTruthy();

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        await page.waitForLoadState("networkidle");

        // Switch JWKS Source Type to "Memory" to reveal the content textarea
        const jwksTypeSelect = customUIFrame
            .locator('select[name="jwks-type"]')
            .first();
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("memory");

        const jwksContentArea = customUIFrame
            .locator('textarea[name="jwks-content"]')
            .first();
        await expect(jwksContentArea).toBeVisible({ timeout: 5000 });
        await expect(jwksContentArea).toBeEnabled({ timeout: 5000 });

        // Fill with invalid JSON that is not valid JWKS
        await jwksContentArea.fill('{"not": "jwks"}');

        const validateButton = customUIFrame
            .getByRole("button", { name: "Test Connection" })
            .first();
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = customUIFrame
            .locator(".verification-result")
            .first();

        // Wait for actual validation content
        await expect(verificationResult).toContainText(
            /error|invalid|fail/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Invalid JWKS content must not show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });
});
