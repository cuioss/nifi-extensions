/**
 * @file Help Tab Test
 * Verifies the help tab functionality in the JWT authenticator UI
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

test.describe("Help Tab", () => {
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

    test("should display help documentation", async ({ page }, _testInfo) => {
        processorLogger.info("Testing help documentation display");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const helpTab = await page.locator('[role="tab"]:has-text("Help")');
            await expect(helpTab).toBeVisible({ timeout: 5000 });
            await helpTab.click();
            processorLogger.info("Clicked Help tab");

            const helpPanel = await page.locator(
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
                const el = await page.locator(section.selector);
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

    test("should have expandable help sections", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing expandable help sections");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const helpTab = await page.locator('[role="tab"]:has-text("Help")');
            await helpTab.click();

            const accordionItems = await page.locator(
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
    }, _testInfo) => {
        processorLogger.info("Testing configuration examples");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const helpTab = await page.locator('[role="tab"]:has-text("Help")');
            await helpTab.click();

            const examplesSection = await page.locator(
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
                const el = await page.locator(example.selector);
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

    test("should have copy code functionality", async ({ page }, _testInfo) => {
        processorLogger.info("Testing copy code functionality");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const helpTab = await page.locator('[role="tab"]:has-text("Help")');
            await helpTab.click();

            const codeBlocks = await page.locator('[data-testid="code-block"]');
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

                const copyFeedback = await page.locator(
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

    test("should display troubleshooting guide", async ({
        page,
    }, _testInfo) => {
        processorLogger.info("Testing troubleshooting guide");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const helpTab = await page.locator('[role="tab"]:has-text("Help")');
            await helpTab.click();

            const troubleshootingSection = await page.locator(
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
                const topicElement = await page.locator(
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

    test("should have search functionality", async ({ page }, _testInfo) => {
        processorLogger.info("Testing help search functionality");

        try {
            await page.goto(
                "https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/",
                {
                    waitUntil: "networkidle",
                    timeout: 15000,
                },
            );

            await page.waitForTimeout(2000);

            const helpTab = await page.locator('[role="tab"]:has-text("Help")');
            await helpTab.click();

            const searchInput = await page.locator(
                '[data-testid="help-search-input"]',
            );
            await expect(searchInput).toBeVisible({ timeout: 5000 });

            await searchInput.fill("token validation");
            processorLogger.info("Entered search query: token validation");

            await searchInput.press("Enter");

            const searchResults = await page.locator(
                '[data-testid="search-results"]',
            );
            await expect(searchResults).toBeVisible({ timeout: 5000 });

            const resultItems = await page.locator(
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

            const clearButton = await page.locator(
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
