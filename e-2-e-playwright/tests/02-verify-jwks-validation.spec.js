/**
 * @file JWKS Validation Test
 * Verifies the JWKS validation button functionality in the JWT authenticator UI.
 *
 * Note: SSRF protection blocks private/loopback addresses (including localhost),
 * so the real Keycloak JWKS URL cannot be validated through the UI. Instead,
 * we test that SSRF protection works correctly and that invalid URLs are rejected.
 */

import {
    serialTest as test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { assertNoAuthError } from "../utils/test-assertions.js";

/**
 * Clicks "Add Issuer" and returns the newly added (last) issuer form container.
 * This scoping prevents shared-state interference from prior tests' issuers.
 */
async function addIssuerAndGetForm(customUIFrame) {
    const addIssuerButton = customUIFrame.getByRole("button", {
        name: "Add Issuer",
    });
    await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
    await addIssuerButton.click();
    const form = customUIFrame.locator(".issuer-form").last();
    await expect(form).toBeVisible({ timeout: 5000 });
    return form;
}

test.describe("JWKS Validation", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should block private/loopback JWKS URLs via SSRF protection", async ({
        customUIFrame,
    }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        const jwksUrlInput = form.locator('input[name="jwks-url"]');
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        // Use localhost Keycloak JWKS URL — SSRF protection should block this
        await jwksUrlInput.fill(
            "http://localhost:9080/realms/oauth_integration_tests/protocol/openid-connect/certs",
        );

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

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

    test("should handle invalid JWKS URL", async ({ customUIFrame }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        const jwksUrlInput = form.locator('input[name="jwks-url"]');
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        await jwksUrlInput.fill("not-a-valid-url");

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

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

    test("should reject JWKS file path outside allowed base directory", async ({ customUIFrame }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        // Switch JWKS Source Type to "File" to reveal the file path input
        const jwksTypeSelect = form.locator('select[name="jwks-type"]');
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("file");

        // Wait for the file input to become visible after type switch
        const jwksFileInput = form.locator('input[name="jwks-file"]');
        await expect(jwksFileInput).toBeVisible({ timeout: 5000 });
        await expect(jwksFileInput).toBeEnabled({ timeout: 5000 });

        // Use /tmp — outside the NiFi base directory, testing base-path restriction
        // (distinct from the "non-existent file" test which uses a valid base dir)
        await jwksFileInput.fill("/tmp/jwks.json");

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

        // Wait for actual validation content (not just element visibility)
        await expect(verificationResult).toContainText(
            /error|invalid|fail|not found|not allowed|outside/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Path outside allowed base directory must not show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should toggle JWKS field visibility when switching source type", async ({
        customUIFrame,
    }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        const jwksTypeSelect = form.locator('select[name="jwks-type"]');
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });

        const urlField = form.locator(".jwks-type-url");
        const fileField = form.locator(".jwks-type-file");
        const memoryField = form.locator(".jwks-type-memory");

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

    test("should accept valid JWKS inline content", async ({ customUIFrame }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        // Switch JWKS Source Type to "Memory" to reveal the content textarea
        const jwksTypeSelect = form.locator('select[name="jwks-type"]');
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("memory");

        const jwksContentArea = form.locator('textarea[name="jwks-content"]');
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

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

        // Wait for validation to complete — must contain actual result, not "Testing..."
        await expect(verificationResult).not.toContainText("Testing", { timeout: 30000 });

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Valid JWKS content should show as success (OK, valid, key found)
        expect(resultText).toMatch(/OK|valid|success|key/i);
    });

    test("should reject invalid JWKS inline content", async ({ customUIFrame }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        // Switch JWKS Source Type to "Memory" to reveal the content textarea
        const jwksTypeSelect = form.locator('select[name="jwks-type"]');
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("memory");

        const jwksContentArea = form.locator('textarea[name="jwks-content"]');
        await expect(jwksContentArea).toBeVisible({ timeout: 5000 });
        await expect(jwksContentArea).toBeEnabled({ timeout: 5000 });

        // Fill with invalid JSON that is not valid JWKS
        await jwksContentArea.fill('{"not": "jwks"}');

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

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

    test("should reject JWKS URL with non-HTTP scheme", async ({ customUIFrame }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        const jwksUrlInput = form.locator('input[name="jwks-url"]');
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
        await expect(jwksUrlInput).toBeEnabled({ timeout: 5000 });

        // ftp:// is not a valid scheme for JWKS URLs — only http(s) allowed
        await jwksUrlInput.fill("ftp://example.com/jwks.json");

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

        await expect(verificationResult).toContainText(
            /error|invalid|fail|scheme/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        assertNoAuthError(resultText);

        // Non-HTTP scheme must not show as success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should reject empty JWKS keys array", async ({ customUIFrame }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        // Switch JWKS Source Type to "Memory" to reveal the content textarea
        const jwksTypeSelect = form.locator('select[name="jwks-type"]');
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("memory");

        const jwksContentArea = form.locator('textarea[name="jwks-content"]');
        await expect(jwksContentArea).toBeVisible({ timeout: 5000 });
        await expect(jwksContentArea).toBeEnabled({ timeout: 5000 });

        // Valid JWKS structure but with empty keys array — distinct from {"not":"jwks"}
        await jwksContentArea.fill('{"keys": []}');

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

        await expect(verificationResult).toContainText(
            /error|invalid|fail|empty/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        assertNoAuthError(resultText);

        // Empty keys array must not show as success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should reject non-existent JWKS file path", async ({ customUIFrame }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        // Switch JWKS Source Type to "File"
        const jwksTypeSelect = form.locator('select[name="jwks-type"]');
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("file");

        // Use a valid path inside NiFi's conf directory that does not exist
        const jwksFileInput = form.locator('input[name="jwks-file"]');
        await expect(jwksFileInput).toBeVisible({ timeout: 5000 });
        await jwksFileInput.fill("/opt/nifi/nifi-current/conf/nonexistent-jwks.json");

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

        await expect(verificationResult).toContainText(
            /error|invalid|fail|not found|does not exist/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        assertNoAuthError(resultText);

        // Non-existent path must not show as success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });

    test("should verify security headers are present on Custom UI responses", async ({
        customUIFrame,
    }) => {
        // Fetch a known Custom UI resource from within the frame to inspect headers
        const headers = await customUIFrame.evaluate(async () => {
            const response = await fetch("component-info", {
                credentials: "same-origin",
            });
            const headerMap = {};
            response.headers.forEach((value, key) => {
                headerMap[key.toLowerCase()] = value;
            });
            return headerMap;
        });

        // SecurityHeadersFilter must set these headers
        expect(headers["x-content-type-options"]).toBe("nosniff");
        expect(headers["x-frame-options"]).toMatch(/DENY|SAMEORIGIN/i);
        expect(headers["referrer-policy"]).toBeTruthy();
        expect(headers["content-security-policy"]).toBeTruthy();
    });

    test("should block path traversal attempts in JWKS file path", async ({
        customUIFrame,
    }) => {
        const form = await addIssuerAndGetForm(customUIFrame);

        // Switch JWKS Source Type to "File"
        const jwksTypeSelect = form.locator('select[name="jwks-type"]');
        await expect(jwksTypeSelect).toBeVisible({ timeout: 5000 });
        await jwksTypeSelect.selectOption("file");

        // Fill with a path traversal attempt
        const jwksFileInput = form.locator('input[name="jwks-file"]');
        await expect(jwksFileInput).toBeVisible({ timeout: 5000 });
        await jwksFileInput.fill("../../etc/passwd");

        const validateButton = form.getByRole("button", { name: "Test Connection" });
        await expect(validateButton).toBeVisible({ timeout: 5000 });
        await validateButton.click();

        const verificationResult = form.locator(".verification-result");

        // Wait for validation result — must show error, not success
        await expect(verificationResult).toContainText(
            /error|invalid|fail|not found|denied|traversal|blocked/i,
            { timeout: 30000 },
        );

        const resultText = await verificationResult.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(resultText);

        // Path traversal must NOT show as a success
        expect(resultText).not.toMatch(/^\s*OK\b/);
    });
});
