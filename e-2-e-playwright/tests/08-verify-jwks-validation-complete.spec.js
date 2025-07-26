/**
 * @file JWKS Validation Complete Test
 * Comprehensive test for JWKS validation functionality including URL and file validation
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import {
    saveTestBrowserLogs,
    setupStrictErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("JWKS Validation Complete", () => {
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

    test("should validate JWKS URL format", async ({ page }, testInfo) => {
        processorLogger.info("Testing JWKS URL format validation");

        try {
            const processorService = new ProcessorService(page, testInfo);

            // Find and configure processor
            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: true,
                });
            const dialog = await processorService.configure(processor);
            await processorService.accessAdvancedProperties(dialog);

            // Wait for custom UI to load
            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            // Determine UI context
            const customUIFrame = page.frameLocator("iframe").first();
            let uiContext = page;

            const iframeInput = customUIFrame.locator(
                '[data-testid="jwks-url-input"]',
            );
            if ((await iframeInput.count()) > 0) {
                uiContext = customUIFrame;
                processorLogger.info("Working with JWKS validation in iframe");
            }

            const testUrls = [
                {
                    url: "https://example.com/.well-known/jwks.json",
                    valid: true,
                    description: "Valid HTTPS URL",
                },
                {
                    url: "http://example.com/jwks.json",
                    valid: false,
                    description: "HTTP URL (should require HTTPS)",
                },
                {
                    url: "ftp://example.com/jwks.json",
                    valid: false,
                    description: "Invalid protocol",
                },
                {
                    url: "not-a-url",
                    valid: false,
                    description: "Not a valid URL",
                },
                {
                    url: "https://example.com:8443/jwks.json",
                    valid: true,
                    description: "Valid URL with port",
                },
            ];

            for (const testCase of testUrls) {
                processorLogger.info(`Testing: ${testCase.description}`);

                const jwksUrlInput = await uiContext.locator(
                    '[data-testid="jwks-url-input"]',
                );
                await jwksUrlInput.clear();
                await jwksUrlInput.fill(testCase.url);

                const validateButton = await uiContext.locator(
                    '[data-testid="validate-jwks-button"]',
                );
                await validateButton.click();

                await page.waitForTimeout(1000);

                if (testCase.valid) {
                    const successIndicator = await uiContext.locator(
                        '[data-testid="validation-success-icon"], [data-testid="validation-success-message"]',
                    );
                    await expect(successIndicator).toBeVisible({
                        timeout: 5000,
                    });
                    processorLogger.info(
                        `✓ ${testCase.description} validated successfully`,
                    );
                } else {
                    const errorIndicator = await uiContext.locator(
                        '[data-testid="validation-error-icon"], [data-testid="validation-error-message"]',
                    );
                    await expect(errorIndicator).toBeVisible({ timeout: 5000 });
                    processorLogger.info(
                        `✓ ${testCase.description} correctly rejected`,
                    );
                }
            }

            processorLogger.success("JWKS URL format validation completed");
        } catch (error) {
            processorLogger.error(
                `Error during URL format validation: ${error.message}`,
            );
            throw error;
        }
    });

    test("should validate JWKS file paths", async ({ page }, testInfo) => {
        processorLogger.info("Testing JWKS file path validation");

        try {
            const processorService = new ProcessorService(page, testInfo);

            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: true,
                });
            const dialog = await processorService.configure(processor);
            await processorService.accessAdvancedProperties(dialog);

            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            const customUIFrame = page.frameLocator("iframe").first();
            let uiContext = page;

            const iframeRadio = customUIFrame.locator(
                '[data-testid="jwks-source-file"]',
            );
            if ((await iframeRadio.count()) > 0) {
                uiContext = customUIFrame;
            }

            const fileSourceRadio = await uiContext.locator(
                '[data-testid="jwks-source-file"]',
            );
            await fileSourceRadio.click();
            processorLogger.info("Selected file source option");

            const testPaths = [
                {
                    path: "/opt/nifi/jwks/keys.json",
                    valid: true,
                    description: "Absolute path",
                },
                {
                    path: "relative/path/keys.json",
                    valid: false,
                    description: "Relative path (should be rejected)",
                },
                {
                    path: "/etc/../opt/nifi/jwks.json",
                    valid: false,
                    description: "Path traversal attempt",
                },
                {
                    path: "",
                    valid: false,
                    description: "Empty path",
                },
                {
                    path: "/opt/nifi/jwks/keys.yaml",
                    valid: false,
                    description: "Non-JSON file extension",
                },
            ];

            for (const testCase of testPaths) {
                processorLogger.info(`Testing: ${testCase.description}`);

                const filePathInput = await page.locator(
                    '[data-testid="jwks-file-input"]',
                );
                await filePathInput.clear();
                if (testCase.path) {
                    await filePathInput.fill(testCase.path);
                }

                const validateButton = await page.locator(
                    '[data-testid="validate-jwks-button"]',
                );
                await validateButton.click();

                await page.waitForTimeout(1000);

                const resultSelector = testCase.valid
                    ? '[data-testid="validation-success"]'
                    : '[data-testid="validation-error"]';

                const result = await page.locator(resultSelector);
                await expect(result).toBeVisible({ timeout: 5000 });
                processorLogger.info(
                    `✓ ${testCase.description} validation result: ${testCase.valid ? "valid" : "invalid"}`,
                );
            }

            processorLogger.success("JWKS file path validation completed");
        } catch (error) {
            processorLogger.error(
                `Error during file path validation: ${error.message}`,
            );
            throw error;
        }
    });

    test("should test JWKS connectivity", async ({ page }, testInfo) => {
        processorLogger.info("Testing JWKS connectivity validation");

        try {
            const processorService = new ProcessorService(page, testInfo);

            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: true,
                });
            const dialog = await processorService.configure(processor);
            await processorService.accessAdvancedProperties(dialog);

            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            const customUIFrame = page.frameLocator("iframe").first();
            let uiContext = page;

            const iframeInput = customUIFrame.locator(
                '[data-testid="jwks-url-input"]',
            );
            if ((await iframeInput.count()) > 0) {
                uiContext = customUIFrame;
                processorLogger.info(
                    "Working with JWKS connectivity in iframe",
                );
            }

            const jwksUrlInput = await uiContext.locator(
                '[data-testid="jwks-url-input"]',
            );
            await jwksUrlInput.fill(
                "https://example.com/.well-known/jwks.json",
            );

            const testConnectionButton = await uiContext.locator(
                '[data-testid="test-connection-button"]',
            );
            await expect(testConnectionButton).toBeVisible({ timeout: 5000 });
            await testConnectionButton.click();
            processorLogger.info("Clicked test connection button");

            const connectionProgress = await uiContext.locator(
                '[data-testid="connection-test-progress"]',
            );
            await expect(connectionProgress).toBeVisible({ timeout: 2000 });
            processorLogger.info("✓ Connection test in progress");

            const connectionResult = await uiContext.locator(
                '[data-testid="connection-test-result"]',
            );
            await expect(connectionResult).toBeVisible({ timeout: 10000 });

            const resultDetails = [
                {
                    selector: '[data-testid="connection-status"]',
                    description: "Connection Status",
                },
                {
                    selector: '[data-testid="response-time"]',
                    description: "Response Time",
                },
                {
                    selector: '[data-testid="jwks-key-count"]',
                    description: "Number of Keys",
                },
                {
                    selector: '[data-testid="jwks-validity"]',
                    description: "JWKS Validity",
                },
            ];

            for (const detail of resultDetails) {
                const el = await uiContext.locator(detail.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ ${detail.description} displayed`);
            }

            processorLogger.success("JWKS connectivity test completed");
        } catch (error) {
            processorLogger.error(
                `Error during connectivity test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should validate JWKS content structure", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing JWKS content structure validation");

        try {
            const processorService = new ProcessorService(page, testInfo);

            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: true,
                });
            const dialog = await processorService.configure(processor);
            await processorService.accessAdvancedProperties(dialog);

            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            const customUIFrame = page.frameLocator("iframe").first();
            let uiContext = page;

            const iframeTab = customUIFrame.locator(
                '[data-testid="jwks-source-manual"]',
            );
            if ((await iframeTab.count()) > 0) {
                uiContext = customUIFrame;
                processorLogger.info(
                    "Working with JWKS content validation in iframe",
                );
            }

            const manualInputTab = await uiContext.locator(
                '[data-testid="jwks-source-manual"]',
            );
            await manualInputTab.click();
            processorLogger.info("Selected manual JWKS input");

            const testJwksContent = [
                {
                    content: JSON.stringify({
                        keys: [
                            {
                                kty: "RSA",
                                use: "sig",
                                kid: "test-key-1",
                                n: "xGONBn1UlzQMtzy8IKdfhmR",
                                e: "AQAB",
                            },
                        ],
                    }),
                    valid: true,
                    description: "Valid JWKS structure",
                },
                {
                    content: JSON.stringify({ keys: [] }),
                    valid: false,
                    description: "Empty keys array",
                },
                {
                    content: "not-json",
                    valid: false,
                    description: "Invalid JSON",
                },
                {
                    content: JSON.stringify({ invalid: "structure" }),
                    valid: false,
                    description: "Missing keys property",
                },
            ];

            for (const testCase of testJwksContent) {
                processorLogger.info(`Testing: ${testCase.description}`);

                const jwksTextarea = await uiContext.locator(
                    '[data-testid="jwks-manual-input"]',
                );
                await jwksTextarea.clear();
                await jwksTextarea.fill(testCase.content);

                const validateButton = await uiContext.locator(
                    '[data-testid="validate-jwks-content-button"]',
                );
                await validateButton.click();

                await page.waitForTimeout(1000);

                if (testCase.valid) {
                    const successMessage = await uiContext.locator(
                        '[data-testid="jwks-content-valid"]',
                    );
                    await expect(successMessage).toBeVisible({ timeout: 5000 });
                    processorLogger.info(
                        `✓ ${testCase.description} validated successfully`,
                    );

                    const keyDetails = await uiContext.locator(
                        '[data-testid="jwks-key-details"]',
                    );
                    await expect(keyDetails).toBeVisible({ timeout: 5000 });
                    processorLogger.info("✓ Key details displayed");
                } else {
                    const errorMessage = await uiContext.locator(
                        '[data-testid="jwks-content-error"]',
                    );
                    await expect(errorMessage).toBeVisible({ timeout: 5000 });
                    processorLogger.info(
                        `✓ ${testCase.description} correctly rejected`,
                    );
                }
            }

            processorLogger.success(
                "JWKS content structure validation completed",
            );
        } catch (error) {
            processorLogger.error(
                `Error during content validation: ${error.message}`,
            );
            throw error;
        }
    });

    test("should perform end-to-end JWKS validation", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing end-to-end JWKS validation");

        try {
            const processorService = new ProcessorService(page, testInfo);

            const processor =
                await processorService.findMultiIssuerJwtAuthenticator({
                    failIfNotFound: true,
                });
            const dialog = await processorService.configure(processor);
            await processorService.accessAdvancedProperties(dialog);

            await page.waitForLoadState("networkidle");
            await page.waitForTimeout(2000);

            const customUIFrame = page.frameLocator("iframe").first();
            let uiContext = page;

            const iframeButton = customUIFrame.locator(
                '[data-testid="add-issuer-button"]',
            );
            if ((await iframeButton.count()) > 0) {
                uiContext = customUIFrame;
                processorLogger.info(
                    "Working with end-to-end validation in iframe",
                );
            }

            processorLogger.info("Step 1: Add issuer configuration");
            const addIssuerButton = await uiContext.locator(
                '[data-testid="add-issuer-button"]',
            );
            await addIssuerButton.click();

            const issuerNameInput = await uiContext.locator(
                '[data-testid="issuer-name-input"]',
            );
            await issuerNameInput.fill("test-issuer");

            const jwksUrlInput = await uiContext.locator(
                '[data-testid="jwks-url-input"]',
            );
            await jwksUrlInput.fill(
                "https://example.com/.well-known/jwks.json",
            );

            processorLogger.info("Step 2: Validate JWKS URL");
            const validateButton = await uiContext.locator(
                '[data-testid="validate-jwks-button"]',
            );
            await validateButton.click();

            await page.waitForTimeout(2000);

            processorLogger.info("Step 3: Test connection");
            const testConnectionButton = await uiContext.locator(
                '[data-testid="test-connection-button"]',
            );
            await testConnectionButton.click();

            await page.waitForTimeout(2000);

            processorLogger.info("Step 4: Save configuration");
            const saveButton = await uiContext.locator(
                '[data-testid="save-issuer-button"]',
            );
            await saveButton.click();

            const savedIssuer = await uiContext.locator(
                '[data-testid="issuer-item"]:has-text("test-issuer")',
            );
            await expect(savedIssuer).toBeVisible({ timeout: 5000 });

            processorLogger.info("Step 5: Verify saved configuration");
            const issuerStatus = savedIssuer.locator(
                '[data-testid="issuer-status"]',
            );
            await expect(issuerStatus).toBeVisible({ timeout: 5000 });
            await expect(issuerStatus).toHaveClass(/valid|active|success/);

            processorLogger.success(
                "End-to-end JWKS validation completed successfully",
            );
        } catch (error) {
            processorLogger.error(
                `Error during end-to-end validation: ${error.message}`,
            );
            throw error;
        }
    });
});
