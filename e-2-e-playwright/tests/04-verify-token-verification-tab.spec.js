/**
 * @file Token Verification Tab Test
 * Verifies the token verification tab functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import {
    saveTestBrowserLogs,
    setupStrictErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Token Verification Tab", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            await setupStrictErrorDetection(page, testInfo, false);
            const authService = new AuthService(page);
            await authService.ensureReady();
        } catch (error) {
            try {
                await saveTestBrowserLogs(testInfo);
            } catch (logError) {
                logTestWarning(
                    "beforeEach",
                    `Failed to save console logs during beforeEach error: ${logError.message}`,
                );
            }
            throw error;
        }
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        try {
            await saveTestBrowserLogs(testInfo);
        } catch (error) {
            logTestWarning(
                "afterEach",
                `Failed to save console logs in afterEach: ${error.message}`,
            );
        }
        cleanupCriticalErrorDetection();
    });

    test("should access token verification tab", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing token verification tab access");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const tokenVerificationTab = await page.locator(
                '[role="tab"]:has-text("Token Verification")',
            );
            await expect(tokenVerificationTab).toBeVisible({ timeout: 5000 });
            await tokenVerificationTab.click();
            processorLogger.info("Clicked Token Verification tab");

            const tabPanel = await page.locator(
                '[role="tabpanel"][data-tab="token-verification"]',
            );
            await expect(tabPanel).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Token Verification tab panel displayed");

            const expectedElements = [
                {
                    selector: '[data-testid="token-input-area"]',
                    description: "Token input area",
                },
                {
                    selector: '[data-testid="verify-token-button"]',
                    description: "Verify token button",
                },
                {
                    selector: '[data-testid="verification-result-panel"]',
                    description: "Verification result panel",
                },
            ];

            for (const element of expectedElements) {
                const el = await page.locator(element.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found ${element.description}`);
            }

            processorLogger.success(
                "Token verification tab accessed successfully",
            );
        } catch (error) {
            processorLogger.error(
                `Error accessing token verification tab: ${error.message}`,
            );
            throw error;
        }
    });

    test("should verify valid JWT token", async ({ page }, _testInfo) => {
        processorLogger.info("Testing valid JWT token verification");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const tokenVerificationTab = await page.locator(
                '[role="tab"]:has-text("Token Verification")',
            );
            await tokenVerificationTab.click();

            const tokenInput = await page.locator(
                '[data-testid="token-input-area"]',
            );
            await expect(tokenInput).toBeVisible({ timeout: 5000 });

            const validToken =
                "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.POstGetfAytaZS82wHcjoTyoqhMyxXiWdR7Nn7A29DNSl0EiXLdwJ6xC6AfgZWF1bOsS_TuYI3OG85AmiExREkrS6tDfTQ2B3WXlrr-wp5AokiRbz3_oB4OxG-W9KcEEbDRcZc0nH3L7LzYptiy1PtAylQGxHTWZXtGz4ht0bAecBgmpdgXMguEIcoqPJ1n3pIWk_dUZegpqx0Lka21H6XxUTxiy8OcaarA8zdnPUnV6AmNP3ecFawIFYdvJB_cm-GvpCSbr8G8y_Mllj8f4x9nBH8pQux89_6gUY618iYv7tuPWBFfEbLxtF2pZS6YC1aSfLQxeNe8djT9YjpvRZA";
            await tokenInput.fill(validToken);
            processorLogger.info("Entered valid JWT token");

            const verifyButton = await page.locator(
                '[data-testid="verify-token-button"]',
            );
            await verifyButton.click();
            processorLogger.info("Clicked verify button");

            const successResult = await page.locator(
                '[data-testid="verification-success"]',
            );
            await expect(successResult).toBeVisible({ timeout: 10000 });
            processorLogger.info("✓ Token verified successfully");

            const tokenDetails = await page.locator(
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
                const el = await page.locator(section.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ ${section.name} section displayed`);
            }

            processorLogger.success("Valid JWT token verified successfully");
        } catch (error) {
            processorLogger.error(
                `Error during valid token verification: ${error.message}`,
            );
            throw error;
        }
    });

    test("should handle invalid JWT token", async ({ page }, _testInfo) => {
        processorLogger.info("Testing invalid JWT token verification");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const tokenVerificationTab = await page.locator(
                '[role="tab"]:has-text("Token Verification")',
            );
            await tokenVerificationTab.click();

            const tokenInput = await page.locator(
                '[data-testid="token-input-area"]',
            );
            await tokenInput.fill("invalid.jwt.token");
            processorLogger.info("Entered invalid JWT token");

            const verifyButton = await page.locator(
                '[data-testid="verify-token-button"]',
            );
            await verifyButton.click();

            const errorResult = await page.locator(
                '[data-testid="verification-error"]',
            );
            await expect(errorResult).toBeVisible({ timeout: 10000 });
            await expect(errorResult).toContainText(/invalid|malformed|error/i);
            processorLogger.info("✓ Error message displayed for invalid token");

            const errorDetails = await page.locator(
                '[data-testid="error-details"]',
            );
            await expect(errorDetails).toBeVisible({ timeout: 5000 });
            processorLogger.success("Invalid JWT token handled correctly");
        } catch (error) {
            processorLogger.error(
                `Error during invalid token test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should display token expiration status", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing token expiration status display");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const tokenVerificationTab = await page.locator(
                '[role="tab"]:has-text("Token Verification")',
            );
            await tokenVerificationTab.click();

            const expiredToken =
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ";

            const tokenInput = await page.locator(
                '[data-testid="token-input-area"]',
            );
            await tokenInput.fill(expiredToken);
            processorLogger.info("Entered expired JWT token");

            const verifyButton = await page.locator(
                '[data-testid="verify-token-button"]',
            );
            await verifyButton.click();

            const expirationWarning = await page.locator(
                '[data-testid="token-expired-warning"]',
            );
            await expect(expirationWarning).toBeVisible({ timeout: 10000 });
            await expect(expirationWarning).toContainText(/expired/i);
            processorLogger.info("✓ Expiration warning displayed");

            const expirationDetails = await page.locator(
                '[data-testid="expiration-details"]',
            );
            await expect(expirationDetails).toBeVisible({ timeout: 5000 });
            processorLogger.success(
                "Token expiration status displayed correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error during expiration status test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should clear token and results", async ({ page }, _testInfo) => {
        processorLogger.info("Testing clear token functionality");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const tokenVerificationTab = await page.locator(
                '[role="tab"]:has-text("Token Verification")',
            );
            await tokenVerificationTab.click();

            const tokenInput = await page.locator(
                '[data-testid="token-input-area"]',
            );
            await tokenInput.fill("some.jwt.token");

            const verifyButton = await page.locator(
                '[data-testid="verify-token-button"]',
            );
            await verifyButton.click();

            await page.waitForTimeout(1000);

            const clearButton = await page.locator(
                '[data-testid="clear-token-button"]',
            );
            await expect(clearButton).toBeVisible({ timeout: 5000 });
            await clearButton.click();
            processorLogger.info("Clicked clear button");

            await expect(tokenInput).toHaveValue("");
            processorLogger.info("✓ Token input cleared");

            const resultPanel = await page.locator(
                '[data-testid="verification-result-panel"]',
            );
            await expect(resultPanel).not.toContainText(
                /success|error|expired/i,
            );
            processorLogger.success("Token and results cleared successfully");
        } catch (error) {
            processorLogger.error(
                `Error during clear token test: ${error.message}`,
            );
            throw error;
        }
    });
});
