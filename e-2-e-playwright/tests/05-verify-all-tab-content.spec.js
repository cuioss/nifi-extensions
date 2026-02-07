import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("Comprehensive JWT Tab Content Verification", () => {
    test.beforeEach(async ({ page, processorManager }) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
    });

    test("all tabs should display their content properly", async ({
        page,
    }, testInfo) => {
        // Starting comprehensive tab content verification
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor using the verified utility
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI using the verified utility
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        // Configuration Tab
        await processorService.clickTab(customUIFrame, "Configuration");

        const _configContent = await customUIFrame
            .locator("#issuer-config")
            .textContent();

        // Check for specific config elements
        const configHasContent = await customUIFrame
            .locator("#issuer-config")
            .evaluate((el) => {
                return (
                    el.innerHTML.trim().length > 0 &&
                    !el.innerHTML.includes("Loading") &&
                    (el.querySelector("form") !== null ||
                        el.querySelector("input") !== null ||
                        el.querySelector(".config-content") !== null)
                );
            });

        await page.screenshot({
            path: `${testInfo.outputDir}/comprehensive-tab-config.png`,
            fullPage: true,
        });

        // Token Verification Tab
        await processorService.clickTab(customUIFrame, "Token Verification");

        const _tokenContent = await customUIFrame
            .locator("#token-verification")
            .textContent();

        const tokenHasContent = await customUIFrame
            .locator("#token-verification")
            .evaluate((el) => {
                return (
                    el.innerHTML.trim().length > 0 &&
                    !el.innerHTML.includes("Loading") &&
                    (el.querySelector("textarea") !== null ||
                        el.querySelector("button") !== null ||
                        el.querySelector(".verification-content") !== null)
                );
            });

        await page.screenshot({
            path: `${testInfo.outputDir}/comprehensive-tab-token.png`,
            fullPage: true,
        });

        // Metrics Tab
        await processorService.clickTab(customUIFrame, "Metrics");

        const metricsContent = await customUIFrame
            .locator("#metrics")
            .textContent();
        // Check for actual metrics data (not the error message)
        expect(metricsContent).toMatch(
            /Validation Metrics|jwt\.validator\.metrics\.title|Total Validations/,
        );
        // Should NOT contain the error message
        expect(metricsContent).not.toContain("Metrics Not Available");

        await page.screenshot({
            path: `${testInfo.outputDir}/comprehensive-tab-metrics.png`,
            fullPage: true,
        });

        // Help Tab
        await processorService.clickTab(customUIFrame, "Help");

        const helpContent = await customUIFrame.locator("#help").textContent();
        // Check for either the translated text or the i18n key
        expect(helpContent).toMatch(
            /JWT Authenticator Help|jwt\.validator\.help\.title|Getting Started/,
        );

        await page.screenshot({
            path: `${testInfo.outputDir}/comprehensive-tab-help.png`,
            fullPage: true,
        });

        // Enforce that all tabs must have meaningful content
        expect(configHasContent).toBe(
            true,
            "Configuration tab must have functional content",
        );
        expect(tokenHasContent).toBe(
            true,
            "Token Verification tab must have functional content",
        );
    });
});
