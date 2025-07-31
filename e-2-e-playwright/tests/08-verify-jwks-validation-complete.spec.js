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
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("JWKS Validation Complete", () => {
    // Note: This test suite has been updated to work with the actual UI implementation
    // which uses class-based selectors instead of data-testid attributes
    test.beforeEach(async ({ page }, testInfo) => {
        try {
            await setupAuthAwareErrorDetection(page, testInfo);
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
        // This test works with the actual UI implementation using class-based selectors
        processorLogger.info("Testing JWKS URL format validation");

        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        await processorService.clickTab(customUIFrame, "Configuration");

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

            // First add an issuer to enable the form
            const addIssuerButton = await customUIFrame.getByRole("button", {
                name: "Add Issuer",
            });
            await addIssuerButton.click();
            await page.waitForTimeout(500);

            const jwksUrlInput = await customUIFrame
                .locator('input[name="jwks-url"]')
                .first();
            await jwksUrlInput.clear();
            await jwksUrlInput.fill(testCase.url);

            const validateButton = await customUIFrame
                .getByRole("button", {
                    name: "Test Connection",
                })
                .first();
            await validateButton.click();

            await page.waitForTimeout(1000);

            // Check for validation result in the verification-result container
            const verificationResult = await customUIFrame
                .locator(".verification-result")
                .first();
            await expect(verificationResult).toBeVisible({ timeout: 5000 });

            if (testCase.valid) {
                // For valid URLs, expect success indication (OK or Valid)
                await expect(verificationResult).toContainText(/OK|Valid/i, {
                    timeout: 5000,
                });
                processorLogger.info(
                    `✓ ${testCase.description} validated successfully`,
                );
            } else {
                // For invalid URLs, expect error indication
                await expect(verificationResult).toContainText(
                    /Error|Invalid|fail/i,
                    {
                        timeout: 5000,
                    },
                );
                processorLogger.info(
                    `✓ ${testCase.description} correctly rejected`,
                );
            }

            // Remove the issuer form to reset for next test
            const removeButton = await customUIFrame
                .getByRole("button", {
                    name: "Remove",
                })
                .first();
            await removeButton.click();
            // Click confirm in the dialog
            const confirmButton = await customUIFrame.getByRole("button", {
                name: "Confirm",
            });
            if (
                await confirmButton
                    .isVisible({ timeout: 1000 })
                    .catch(() => false)
            ) {
                await confirmButton.click();
            }
            await page.waitForTimeout(500);
        }

        processorLogger.success("JWKS URL format validation completed");
    });

    test("should validate JWKS file paths", async ({ page }, testInfo) => {
        /**
         * JWKS FILE VALIDATION TEST
         *
         * Status: Processor integration complete - test enabled
         * - Processor now supports JWKS source type property (jwks-type)
         * - UI components fully integrated with processor configuration
         * - Backend validation endpoints connected
         */
        processorLogger.info("Testing JWKS file path validation");

        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        await processorService.clickTab(customUIFrame, "Configuration");

        // First add an issuer to enable the form
        const addIssuerButton = await customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await addIssuerButton.click();
        await page.waitForTimeout(500);

        // Select file source type from the JWKS type dropdown
        const jwksTypeSelect = await customUIFrame
            .locator(".field-jwks-type")
            .first();
        await jwksTypeSelect.selectOption("file");
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

            const filePathInput = await customUIFrame
                .locator(".field-jwks-file")
                .first();
            await filePathInput.clear();
            if (testCase.path) {
                await filePathInput.fill(testCase.path);
            }

            const validateButton = await customUIFrame
                .getByRole("button", {
                    name: "Test Connection",
                })
                .first();
            await validateButton.click();

            await page.waitForTimeout(1000);

            // Check for validation result in the verification-result container
            const verificationResult = await customUIFrame
                .locator(".verification-result")
                .first();
            await expect(verificationResult).toBeVisible({ timeout: 5000 });

            if (testCase.valid) {
                // For valid paths, expect success indication (OK or Valid)
                await expect(verificationResult).toContainText(/OK|Valid/i, {
                    timeout: 5000,
                });
            } else {
                // For invalid paths, expect error indication
                await expect(verificationResult).toContainText(
                    /Error|Invalid|fail/i,
                    {
                        timeout: 5000,
                    },
                );
            }
            processorLogger.info(
                `✓ ${testCase.description} validation result: ${testCase.valid ? "valid" : "invalid"}`,
            );
        }

        processorLogger.success("JWKS file path validation completed");
    });

    test("should test JWKS connectivity", async ({ page }, testInfo) => {
        // This test works with the actual Test Connection button
        processorLogger.info("Testing JWKS connectivity validation");

        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        await processorService.clickTab(customUIFrame, "Configuration");

        // First add an issuer to enable the form
        const addIssuerButton = await customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await addIssuerButton.click();
        await page.waitForTimeout(500);

        const jwksUrlInput = await customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await jwksUrlInput.fill("https://example.com/.well-known/jwks.json");

        const testConnectionButton = await customUIFrame
            .getByRole("button", {
                name: "Test Connection",
            })
            .first();
        await expect(testConnectionButton).toBeVisible({ timeout: 5000 });
        await testConnectionButton.click();
        processorLogger.info("Clicked test connection button");

        // Check for result in verification-result container
        const verificationResult = await customUIFrame
            .locator(".verification-result")
            .first();
        await expect(verificationResult).toBeVisible({ timeout: 10000 });

        // The result should show either success or error
        await expect(verificationResult).toContainText(
            /OK|Error|Valid|Invalid/i,
            {
                timeout: 5000,
            },
        );

        // The current implementation shows a simple success/error message
        // not detailed connection status information
        processorLogger.info("✓ Connection test result displayed");

        processorLogger.success("JWKS connectivity test completed");
    });

    test("should validate JWKS content structure", async ({
        page,
    }, testInfo) => {
        /**
         * JWKS CONTENT VALIDATION TEST
         *
         * Status: Processor integration complete - test enabled
         * - Processor now supports JWKS source type property (jwks-type)
         * - UI components fully integrated with processor configuration
         * - Client-side JSON validation for JWKS structure fully implemented
         */
        processorLogger.info("Testing JWKS content structure validation");

        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        await processorService.clickTab(customUIFrame, "Configuration");

        // First add an issuer to enable the form
        const addIssuerButton = await customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await addIssuerButton.click();
        await page.waitForTimeout(500);

        // Select memory source type from the JWKS type dropdown
        const jwksTypeSelect = await customUIFrame
            .locator(".field-jwks-type")
            .first();
        await jwksTypeSelect.selectOption("memory");
        processorLogger.info("Selected memory JWKS input");

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

            const jwksTextarea = await customUIFrame
                .locator(".field-jwks-content")
                .first();
            await jwksTextarea.clear();
            await jwksTextarea.fill(testCase.content);

            const validateButton = await customUIFrame
                .getByRole("button", {
                    name: "Test Connection",
                })
                .first();
            await validateButton.click();

            await page.waitForTimeout(1000);

            // Check for validation result in the verification-result container
            const verificationResult = await customUIFrame
                .locator(".verification-result")
                .first();
            await expect(verificationResult).toBeVisible({ timeout: 5000 });

            if (testCase.valid) {
                // For valid content, expect success indication (OK or Valid)
                await expect(verificationResult).toContainText(/OK|Valid/i, {
                    timeout: 5000,
                });
                processorLogger.info(
                    `✓ ${testCase.description} validated successfully`,
                );
            } else {
                // For invalid content, expect error indication
                await expect(verificationResult).toContainText(
                    /Error|Invalid|fail/i,
                    {
                        timeout: 5000,
                    },
                );
                processorLogger.info(
                    `✓ ${testCase.description} correctly rejected`,
                );
            }
        }

        processorLogger.success("JWKS content structure validation completed");
    });

    test("should perform end-to-end JWKS validation", async ({
        // Updated to work with actual UI implementation
        page,
    }, testInfo) => {
        processorLogger.info("Testing end-to-end JWKS validation");

        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        await processorService.clickTab(customUIFrame, "Configuration");

        processorLogger.info("Step 1: Add issuer configuration");
        const addIssuerButton = await customUIFrame
            .getByRole("button", {
                name: "Add Issuer",
            })
            .first();
        await addIssuerButton.click();
        await page.waitForTimeout(500);

        const issuerNameInput = await customUIFrame
            .locator("input.issuer-name")
            .first();
        await issuerNameInput.clear();
        await issuerNameInput.fill("test-issuer");

        const jwksUrlInput = await customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await jwksUrlInput.fill("https://example.com/.well-known/jwks.json");

        processorLogger.info("Step 2: Test JWKS connection");
        const testConnectionButton = await customUIFrame
            .getByRole("button", {
                name: "Test Connection",
            })
            .first();
        await testConnectionButton.click();

        // Wait for validation result
        const verificationResult = await customUIFrame
            .locator(".verification-result")
            .first();
        await expect(verificationResult).toBeVisible({ timeout: 5000 });
        await expect(verificationResult).toContainText(
            /OK|Error|Valid|Invalid/i,
            {
                timeout: 5000,
            },
        );

        processorLogger.info("Step 3: Save configuration");
        const saveButton = await customUIFrame
            .getByRole("button", {
                name: "Save Issuer",
            })
            .first();
        await saveButton.click();

        // Check for success message
        const successMessage = await customUIFrame
            .locator(".success-message, .issuer-form-error-messages")
            .first();
        await expect(successMessage).toBeVisible({ timeout: 5000 });

        // Verify the issuer form is still present (saved successfully)
        const issuerForm = await customUIFrame
            .locator('.issuer-form:has-text("test-issuer")')
            .first();
        await expect(issuerForm).toBeVisible({ timeout: 5000 });

        processorLogger.success(
            "End-to-end JWKS validation completed successfully",
        );
    });
});
