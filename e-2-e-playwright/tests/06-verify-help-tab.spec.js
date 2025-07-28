/**
 * @file Help Tab Test
 * Verifies the help tab functionality in the JWT authenticator UI
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

test.describe("Help Tab", () => {
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

    test("should display help documentation", async ({ page }, testInfo) => {
        processorLogger.info("Testing help documentation display");

        try {
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

            const helpPanel = await customUIFrame.locator(
                '[role="tabpanel"][data-tab="help"]',
            );
            await expect(helpPanel).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Help tab panel displayed");

            const helpSections = [
                {
                    selector: '[data-testid="help-overview"]',
                    description: "Overview Section",
                },
                {
                    selector: '[data-testid="help-configuration"]',
                    description: "Configuration Guide",
                },
                {
                    selector: '[data-testid="help-troubleshooting"]',
                    description: "Troubleshooting Section",
                },
                {
                    selector: '[data-testid="help-examples"]',
                    description: "Examples Section",
                },
                {
                    selector: '[data-testid="help-faq"]',
                    description: "FAQ Section",
                },
            ];

            for (const section of helpSections) {
                const el = await customUIFrame.locator(section.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found ${section.description}`);
            }

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

            const examplesSection = await customUIFrame.locator(
                '[data-testid="help-examples"]',
            );
            await expect(examplesSection).toBeVisible({ timeout: 5000 });

            const exampleTypes = [
                {
                    selector: '[data-testid="example-basic-config"]',
                    description: "Basic Configuration Example",
                },
                {
                    selector: '[data-testid="example-multi-issuer"]',
                    description: "Multi-Issuer Example",
                },
                {
                    selector: '[data-testid="example-jwks-file"]',
                    description: "JWKS File Example",
                },
                {
                    selector: '[data-testid="example-authorization"]',
                    description: "Authorization Example",
                },
            ];

            for (const example of exampleTypes) {
                const el = await customUIFrame.locator(example.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found ${example.description}`);

                const codeBlock = el.locator("pre, code");
                await expect(codeBlock).toBeVisible({ timeout: 5000 });
                processorLogger.info(
                    `✓ Code block visible for ${example.description}`,
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

            const troubleshootingSection = await customUIFrame.locator(
                '[data-testid="help-troubleshooting"]',
            );
            await expect(troubleshootingSection).toBeVisible({ timeout: 5000 });

            const troubleshootingTopics = [
                "Token Validation Failures",
                "JWKS Connection Issues",
                "Authorization Errors",
                "Performance Issues",
                "Configuration Problems",
            ];

            for (const topic of troubleshootingTopics) {
                const topicElement = await customUIFrame.locator(
                    `[data-testid="troubleshooting-topic"]:has-text("${topic}")`,
                );
                await expect(topicElement).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found troubleshooting topic: ${topic}`);
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

            const searchInput = await customUIFrame.locator(
                '[data-testid="help-search-input"]',
            );
            await expect(searchInput).toBeVisible({ timeout: 5000 });

            await searchInput.fill("token validation");
            processorLogger.info("Entered search query: token validation");

            await searchInput.press("Enter");

            const searchResults = await customUIFrame.locator(
                '[data-testid="search-results"]',
            );
            await expect(searchResults).toBeVisible({ timeout: 5000 });

            const resultItems = await customUIFrame.locator(
                '[data-testid="search-result-item"]',
            );
            const resultCount = await resultItems.count();
            processorLogger.info(`Found ${resultCount} search results`);

            if (resultCount > 0) {
                const firstResult = resultItems.first();
                await expect(firstResult).toBeVisible({ timeout: 5000 });
                await expect(firstResult).toContainText(/token|validation/i);
                processorLogger.info(
                    "✓ Search results contain relevant content",
                );
            }

            const clearButton = await customUIFrame.locator(
                '[data-testid="clear-search-button"]',
            );
            await expect(clearButton).toBeVisible({ timeout: 5000 });
            await clearButton.click();
            processorLogger.info("Cleared search");

            await expect(searchInput).toHaveValue("");
            await expect(searchResults).not.toBeVisible({ timeout: 5000 });

            processorLogger.success(
                "Help search functionality working correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error testing search functionality: ${error.message}`,
            );
            throw error;
        }
    });
});
