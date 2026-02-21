/**
 * @file Help Tab Test
 * Verifies the help tab functionality in the JWT authenticator UI
 * @version 1.1.0
 */

import {
    serialTest as test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";

test.describe("Help Tab", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should display help documentation with essential keywords", async ({
        customUIFrame,
        processorService,
    }) => {
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

        // Verify content contains essential domain keywords
        const helpText = await helpPanel.textContent();
        const essentialKeywords = [
            "Token Verification",
            "JWT",
            "JWKS",
            "issuer",
        ];
        for (const keyword of essentialKeywords) {
            expect(helpText.toLowerCase()).toContain(keyword.toLowerCase());
        }

        // Check for collapsible sections as interactive elements
        const collapsibleHeaders = customUIFrame.locator(".collapsible-header");
        const headerCount = await collapsibleHeaders.count();
        expect(headerCount).toBeGreaterThan(0);

        // Verify the Help tab title is properly translated (not showing the i18n key)
        const helpTitle = customUIFrame.locator("#help h3, #help h2").first();
        const helpTitleText = await helpTitle.textContent();
        expect(helpTitleText).not.toContain("jwt.validator.help.title");
        expect(helpTitleText).toMatch(
            /Component Help|JWT Authenticator Help|JWT-Authentifikator-Hilfe/,
        );
    });

    test("should have expandable help sections", async ({
        customUIFrame,
        processorService,
    }) => {
        await processorService.clickTab(customUIFrame, "Help");

        const accordionItems = customUIFrame.locator(
            '[data-testid="help-accordion-item"]:visible',
        );
        const itemCount = await accordionItems.count();

        // Accordion items must exist — fail if they don't
        expect(itemCount).toBeGreaterThan(0);

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
    });

    test("should display configuration examples", async ({
        customUIFrame,
        processorService,
    }) => {
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

    test("should display troubleshooting guide", async ({
        customUIFrame,
        processorService,
    }) => {
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
        }

        // Check that troubleshooting content is visible
        const troubleshootingContent = customUIFrame.locator(
            '.help-section:has(.collapsible-header:has-text("Troubleshooting")) .collapsible-content',
        );
        await expect(troubleshootingContent).toBeVisible({ timeout: 5000 });

        // Verify troubleshooting content has substantial text (not empty or stub)
        const troubleshootingText = await troubleshootingContent.textContent();
        expect(troubleshootingText.length).toBeGreaterThan(100);

        // Verify structural content: multiple items (list items or paragraphs)
        const listItems = troubleshootingContent.locator("li, p, dt");
        const itemCount = await listItems.count();
        expect(itemCount).toBeGreaterThan(2);
    });
});
