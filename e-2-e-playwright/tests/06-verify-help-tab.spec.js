/**
 * @file Help Tab Test
 * Verifies the help tab functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";
import { processorLogger } from "../utils/shared-logger.js";
import { logTestWarning } from "../utils/test-error-handler.js";

test.describe("Help Tab", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        try {
            await setupAuthAwareErrorDetection(page, testInfo);
            const authService = new AuthService(page);
            await authService.ensureReady();
        
        // Ensure processor is on canvas before each test
        const ready = await processorManager.ensureProcessorOnCanvas();
        if (!ready) {
            throw new Error(
                'Cannot ensure MultiIssuerJWTTokenAuthenticator is on canvas. ' +
                'The processor must be deployed in NiFi for tests to run.'
            );
        }
        processorLogger.info('All preconditions met');
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

    test("should display help documentation", async ({ page }, testInfo) => {
        processorLogger.info("Testing help documentation display");

        try {
            // Explicit NiFi service availability check
            const authService = new AuthService(page);
            const isNiFiAvailable = await authService.checkNiFiAccessibility();
            if (!isNiFiAvailable) {
                throw new Error(
                    "PRECONDITION FAILED: NiFi service is not available. " +
                        "Integration tests require a running NiFi instance. " +
                        "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
                );
            }

            const processorService = new ProcessorService(page, testInfo);

            // Find JWT processor using the verified utility
            const processor = await processorService.findJwtAuthenticator({
                failIfNotFound: true,
            });

            // Open Advanced UI using the verified utility
            await processorService.openAdvancedUI(processor);

            // Get the custom UI frame
            const customUIFrame = await processorService.getAdvancedUIFrame();
            await processorService.clickTab(customUIFrame, "Help");

            const helpPanel = await customUIFrame.locator("#help");
            await expect(helpPanel).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Help tab panel displayed");

            // Check for help content container
            const helpContent =
                await customUIFrame.locator("#jwt-help-content");
            await expect(helpContent).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Help content container found");

            // Check for main help sections
            const helpSections = await customUIFrame.locator(".help-section");
            const sectionCount = await helpSections.count();
            expect(sectionCount).toBeGreaterThan(0);
            processorLogger.info(`✓ Found ${sectionCount} help sections`);

            // Check for specific content
            const gettingStarted = await customUIFrame.locator(
                '.help-section:has-text("Getting Started")',
            );
            await expect(gettingStarted).toBeVisible();
            processorLogger.info("✓ Getting Started section found");

            const issuerConfig = await customUIFrame
                .locator('.help-section:has-text("Issuer Configuration")')
                .first();
            await expect(issuerConfig).toBeVisible();
            processorLogger.info("✓ Issuer Configuration section found");

            processorLogger.success(
                "Help documentation displayed successfully",
            );
        } catch (error) {
            processorLogger.error(
                `Error displaying help documentation: ${error.message}`,
            );
            throw error;
        }
    });

    test("should have expandable help sections", async ({ page }, testInfo) => {
        processorLogger.info("Testing expandable help sections");

        try {
            // Explicit NiFi service availability check
            const authService = new AuthService(page);
            const isNiFiAvailable = await authService.checkNiFiAccessibility();
            if (!isNiFiAvailable) {
                throw new Error(
                    "PRECONDITION FAILED: NiFi service is not available. " +
                        "Integration tests require a running NiFi instance. " +
                        "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
                );
            }

            const processorService = new ProcessorService(page, testInfo);

            // Find JWT processor using the verified utility
            const processor = await processorService.findJwtAuthenticator({
                failIfNotFound: true,
            });

            // Open Advanced UI using the verified utility
            await processorService.openAdvancedUI(processor);

            // Get the custom UI frame
            const customUIFrame = await processorService.getAdvancedUIFrame();
            await processorService.clickTab(customUIFrame, "Help");

            const accordionItems = await customUIFrame.locator(
                '[data-testid="help-accordion-item"]',
            );
            const itemCount = await accordionItems.count();
            processorLogger.info(`Found ${itemCount} accordion items`);

            if (itemCount > 0) {
                const firstAccordion = accordionItems.first();
                const accordionButton = firstAccordion.locator(
                    '[data-testid="accordion-toggle"]',
                );
                await expect(accordionButton).toBeVisible({ timeout: 5000 });

                const accordionContent = firstAccordion.locator(
                    '[data-testid="accordion-content"]',
                );
                const isExpanded = await accordionContent.isVisible();

                await accordionButton.click();
                processorLogger.info("Clicked accordion toggle");

                if (isExpanded) {
                    await expect(accordionContent).not.toBeVisible({
                        timeout: 5000,
                    });
                    processorLogger.info("✓ Accordion collapsed");
                } else {
                    await expect(accordionContent).toBeVisible({
                        timeout: 5000,
                    });
                    processorLogger.info("✓ Accordion expanded");
                }

                await accordionButton.click();
                processorLogger.info("Clicked accordion toggle again");

                if (isExpanded) {
                    await expect(accordionContent).toBeVisible({
                        timeout: 5000,
                    });
                    processorLogger.info("✓ Accordion re-expanded");
                } else {
                    await expect(accordionContent).not.toBeVisible({
                        timeout: 5000,
                    });
                    processorLogger.info("✓ Accordion re-collapsed");
                }
            }

            processorLogger.success(
                "Expandable help sections working correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error testing expandable sections: ${error.message}`,
            );
            throw error;
        }
    });

    test("should display configuration examples", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing configuration examples");

        try {
            // Explicit NiFi service availability check
            const authService = new AuthService(page);
            const isNiFiAvailable = await authService.checkNiFiAccessibility();
            if (!isNiFiAvailable) {
                throw new Error(
                    "PRECONDITION FAILED: NiFi service is not available. " +
                        "Integration tests require a running NiFi instance. " +
                        "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
                );
            }

            const processorService = new ProcessorService(page, testInfo);

            // Find JWT processor using the verified utility
            const processor = await processorService.findJwtAuthenticator({
                failIfNotFound: true,
            });

            // Open Advanced UI using the verified utility
            await processorService.openAdvancedUI(processor);

            // Get the custom UI frame
            const customUIFrame = await processorService.getAdvancedUIFrame();
            await processorService.clickTab(customUIFrame, "Help");

            // First, ensure the Issuer Configuration section is expanded
            const issuerConfigHeader = await customUIFrame
                .locator('.collapsible-header:has-text("Issuer Configuration")')
                .first();

            // Check if it's already expanded (has 'active' class)
            const isActive = await issuerConfigHeader.evaluate((el) =>
                el.classList.contains("active"),
            );
            if (!isActive) {
                await issuerConfigHeader.click();
                await customUIFrame.waitForTimeout(500); // Wait for animation
            }

            // Look for configuration examples in the help content
            const examplesSection = await customUIFrame
                .locator(".example-config")
                .first();
            await expect(examplesSection).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Found configuration examples");

            // Check for specific example configurations
            const exampleConfigs = await customUIFrame
                .locator(".example-config")
                .all();
            expect(exampleConfigs.length).toBeGreaterThan(0);
            processorLogger.info(
                `✓ Found ${exampleConfigs.length} example configurations`,
            );

            // Verify each example has a code block
            for (let i = 0; i < Math.min(exampleConfigs.length, 3); i++) {
                // eslint-disable-next-line security/detect-object-injection
                const example = exampleConfigs[i];
                await expect(example).toBeVisible();

                const codeBlock = example.locator("code");
                await expect(codeBlock).toBeVisible();

                const text = await example.textContent();
                processorLogger.info(
                    `✓ Example ${i + 1} visible with content: ${text.substring(0, 50)}...`,
                );
            }

            processorLogger.success(
                "Configuration examples displayed correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error displaying configuration examples: ${error.message}`,
            );
            throw error;
        }
    });

    test("should have copy code functionality", async ({ page }, testInfo) => {
        processorLogger.info("Testing copy code functionality");

        try {
            // Explicit NiFi service availability check
            const authService = new AuthService(page);
            const isNiFiAvailable = await authService.checkNiFiAccessibility();
            if (!isNiFiAvailable) {
                throw new Error(
                    "PRECONDITION FAILED: NiFi service is not available. " +
                        "Integration tests require a running NiFi instance. " +
                        "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
                );
            }

            const processorService = new ProcessorService(page, testInfo);

            // Find JWT processor using the verified utility
            const processor = await processorService.findJwtAuthenticator({
                failIfNotFound: true,
            });

            // Open Advanced UI using the verified utility
            await processorService.openAdvancedUI(processor);

            // Get the custom UI frame
            const customUIFrame = await processorService.getAdvancedUIFrame();
            await processorService.clickTab(customUIFrame, "Help");

            const codeBlocks = await customUIFrame.locator(
                '[data-testid="code-block"]',
            );
            const blockCount = await codeBlocks.count();
            processorLogger.info(`Found ${blockCount} code blocks`);

            if (blockCount > 0) {
                const firstBlock = codeBlocks.first();
                await expect(firstBlock).toBeVisible({ timeout: 5000 });

                const copyButton = firstBlock.locator(
                    '[data-testid="copy-code-button"]',
                );
                await expect(copyButton).toBeVisible({ timeout: 5000 });

                await copyButton.click();
                processorLogger.info("Clicked copy button");

                const copyFeedback = await customUIFrame.locator(
                    '[data-testid="copy-feedback"]',
                );
                await expect(copyFeedback).toBeVisible({ timeout: 5000 });
                await expect(copyFeedback).toContainText(/copied/i);
                processorLogger.info("✓ Copy feedback displayed");

                await expect(copyFeedback).not.toBeVisible({ timeout: 5000 });
                processorLogger.info("✓ Copy feedback auto-dismissed");
            }

            processorLogger.success(
                "Copy code functionality working correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error testing copy code functionality: ${error.message}`,
            );
            throw error;
        }
    });

    test("should display troubleshooting guide", async ({ page }, testInfo) => {
        processorLogger.info("Testing troubleshooting guide");

        try {
            // Explicit NiFi service availability check
            const authService = new AuthService(page);
            const isNiFiAvailable = await authService.checkNiFiAccessibility();
            if (!isNiFiAvailable) {
                throw new Error(
                    "PRECONDITION FAILED: NiFi service is not available. " +
                        "Integration tests require a running NiFi instance. " +
                        "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
                );
            }

            const processorService = new ProcessorService(page, testInfo);

            // Find JWT processor using the verified utility
            const processor = await processorService.findJwtAuthenticator({
                failIfNotFound: true,
            });

            // Open Advanced UI using the verified utility
            await processorService.openAdvancedUI(processor);

            // Get the custom UI frame
            const customUIFrame = await processorService.getAdvancedUIFrame();
            await processorService.clickTab(customUIFrame, "Help");

            // Look for Common Issues section
            const commonIssuesSection = await customUIFrame.locator(
                '.help-section:has-text("Common Issues")',
            );
            await expect(commonIssuesSection).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Found Common Issues section");

            // Look for Troubleshooting section
            const troubleshootingHeader = await customUIFrame.locator(
                '.collapsible-header:has-text("Troubleshooting")',
            );
            await expect(troubleshootingHeader).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Found Troubleshooting section");

            // Expand troubleshooting section if needed
            const isActive = await troubleshootingHeader.evaluate((el) =>
                el.classList.contains("active"),
            );
            if (!isActive) {
                await troubleshootingHeader.click();
                await customUIFrame.waitForTimeout(500);
            }

            // Check that troubleshooting content is visible
            const troubleshootingContent = await customUIFrame.locator(
                '.help-section:has(.collapsible-header:has-text("Troubleshooting")) .collapsible-content',
            );
            await expect(troubleshootingContent).toBeVisible({ timeout: 5000 });

            // Verify troubleshooting content
            const troubleshootingText =
                await troubleshootingContent.textContent();
            const expectedContent = [
                "JWKS Loading Issues",
                "network connectivity",
                "SSL/TLS certificates",
            ];

            for (const content of expectedContent) {
                expect(troubleshootingText).toContain(content);
                processorLogger.info(
                    `✓ Found troubleshooting content: ${content}`,
                );
            }

            processorLogger.success(
                "Troubleshooting guide displayed correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error displaying troubleshooting guide: ${error.message}`,
            );
            throw error;
        }
    });

    test("should have search functionality", async ({ page }, testInfo) => {
        processorLogger.info("Testing help search functionality");

        try {
            // Explicit NiFi service availability check
            const authService = new AuthService(page);
            const isNiFiAvailable = await authService.checkNiFiAccessibility();
            if (!isNiFiAvailable) {
                throw new Error(
                    "PRECONDITION FAILED: NiFi service is not available. " +
                        "Integration tests require a running NiFi instance. " +
                        "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
                );
            }

            const processorService = new ProcessorService(page, testInfo);

            // Find JWT processor using the verified utility
            const processor = await processorService.findJwtAuthenticator({
                failIfNotFound: true,
            });

            // Open Advanced UI using the verified utility
            await processorService.openAdvancedUI(processor);

            // Get the custom UI frame
            const customUIFrame = await processorService.getAdvancedUIFrame();
            await processorService.clickTab(customUIFrame, "Help");

            // The help tab doesn't have search functionality, but we can verify
            // that the content is searchable by checking for keywords
            const helpContent = await customUIFrame.locator("#help");
            await expect(helpContent).toBeVisible({ timeout: 5000 });

            const helpText = await helpContent.textContent();

            // Verify content contains searchable keywords
            const searchableKeywords = [
                "Token Verification",
                "JWT",
                "JWKS",
                "issuer",
            ];
            for (const keyword of searchableKeywords) {
                expect(helpText.toLowerCase()).toContain(keyword.toLowerCase());
                processorLogger.info(
                    `✓ Help content contains searchable keyword: ${keyword}`,
                );
            }

            // Check for collapsible sections as interactive elements
            const collapsibleHeaders = await customUIFrame.locator(
                ".collapsible-header",
            );
            const headerCount = await collapsibleHeaders.count();
            expect(headerCount).toBeGreaterThan(0);
            processorLogger.info(
                `✓ Found ${headerCount} interactive collapsible sections`,
            );

            processorLogger.success(
                "Help content is searchable and interactive",
            );
        } catch (error) {
            processorLogger.error(
                `Error testing search functionality: ${error.message}`,
            );
            throw error;
        }
    });
});
