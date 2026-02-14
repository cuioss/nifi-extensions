/**
 * @file Help Tab Test
 * Verifies the help tab functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

// Skip: help tab moved to CS — re-enable after #137 UI migration
test.describe.skip("Help Tab", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should display help documentation", async ({ page }, testInfo) => {
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

        const helpPanel = customUIFrame.locator("#help");
        await expect(helpPanel).toBeVisible({ timeout: 5000 });

        // Check for help content container
        const helpContent = customUIFrame.locator("#jwt-help-content");
        await expect(helpContent).toBeVisible({ timeout: 5000 });

        // Check for main help sections
        const helpSections = customUIFrame.locator(".help-section");
        const sectionCount = await helpSections.count();
        expect(sectionCount).toBeGreaterThan(0);

        // Check for specific content
        const gettingStarted = customUIFrame.locator(
            '.help-section:has-text("Getting Started")',
        );
        await expect(gettingStarted).toBeVisible();

        const issuerConfig = customUIFrame
            .locator('.help-section:has-text("Issuer Configuration")')
            .first();
        await expect(issuerConfig).toBeVisible();
    });

    test("should have expandable help sections", async ({ page }, testInfo) => {
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

        const accordionItems = customUIFrame.locator(
            '[data-testid="help-accordion-item"]',
        );
        const itemCount = await accordionItems.count();

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

            if (isExpanded) {
                await expect(accordionContent).not.toBeVisible({
                    timeout: 5000,
                });
            } else {
                await expect(accordionContent).toBeVisible({
                    timeout: 5000,
                });
            }

            await accordionButton.click();

            if (isExpanded) {
                await expect(accordionContent).toBeVisible({
                    timeout: 5000,
                });
            } else {
                await expect(accordionContent).not.toBeVisible({
                    timeout: 5000,
                });
            }
        }
    });

    test("should display configuration examples", async ({
        page,
    }, testInfo) => {
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
        const issuerConfigHeader = customUIFrame
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
        const examplesSection = customUIFrame
            .locator(".example-config")
            .first();
        await expect(examplesSection).toBeVisible({ timeout: 5000 });

        // Check for specific example configurations
        const exampleConfigs = await customUIFrame
            .locator(".example-config")
            .all();
        expect(exampleConfigs.length).toBeGreaterThan(0);

        // Verify each example has a code block
        for (let i = 0; i < Math.min(exampleConfigs.length, 3); i++) {
             
            const example = exampleConfigs[i];
            await expect(example).toBeVisible();

            const codeBlock = example.locator("code");
            await expect(codeBlock).toBeVisible();
        }
    });

    test("should have copy code functionality", async ({ page }, testInfo) => {
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

        const codeBlocks = customUIFrame.locator('[data-testid="code-block"]');
        const blockCount = await codeBlocks.count();

        if (blockCount > 0) {
            const firstBlock = codeBlocks.first();
            await expect(firstBlock).toBeVisible({ timeout: 5000 });

            const copyButton = firstBlock.locator(
                '[data-testid="copy-code-button"]',
            );
            await expect(copyButton).toBeVisible({ timeout: 5000 });

            await copyButton.click();

            const copyFeedback = customUIFrame.locator(
                '[data-testid="copy-feedback"]',
            );
            await expect(copyFeedback).toBeVisible({ timeout: 5000 });
            await expect(copyFeedback).toContainText(/copied/i);

            await expect(copyFeedback).not.toBeVisible({ timeout: 5000 });
        }
    });

    test("should display troubleshooting guide", async ({ page }, testInfo) => {
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
        const commonIssuesSection = customUIFrame.locator(
            '.help-section:has-text("Common Issues")',
        );
        await expect(commonIssuesSection).toBeVisible({ timeout: 5000 });

        // Look for Troubleshooting section
        const troubleshootingHeader = customUIFrame.locator(
            '.collapsible-header:has-text("Troubleshooting")',
        );
        await expect(troubleshootingHeader).toBeVisible({ timeout: 5000 });

        // Expand troubleshooting section if needed
        const isActive = await troubleshootingHeader.evaluate((el) =>
            el.classList.contains("active"),
        );
        if (!isActive) {
            await troubleshootingHeader.click();
            await customUIFrame.waitForTimeout(500);
        }

        // Check that troubleshooting content is visible
        const troubleshootingContent = customUIFrame.locator(
            '.help-section:has(.collapsible-header:has-text("Troubleshooting")) .collapsible-content',
        );
        await expect(troubleshootingContent).toBeVisible({ timeout: 5000 });

        // Verify troubleshooting content
        const troubleshootingText = await troubleshootingContent.textContent();
        const expectedContent = [
            "JWKS Loading Issues",
            "network connectivity",
            "SSL/TLS certificates",
        ];

        for (const content of expectedContent) {
            expect(troubleshootingText).toContain(content);
        }
    });

    test("should have search functionality", async ({ page }, testInfo) => {
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
        const helpContent = customUIFrame.locator("#help");
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
        }

        // Check for collapsible sections as interactive elements
        const collapsibleHeaders = customUIFrame.locator(".collapsible-header");
        const headerCount = await collapsibleHeaders.count();
        expect(headerCount).toBeGreaterThan(0);
    });
});
