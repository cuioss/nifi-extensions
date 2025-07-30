import { test, expect } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import {
    saveTestBrowserLogs,
    setupAuthAwareErrorDetection,
} from "../utils/console-logger.js";
import { cleanupCriticalErrorDetection } from "../utils/critical-error-detector.js";

test.describe("Comprehensive JWT Tab Content Verification", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await setupAuthAwareErrorDetection(page, testInfo);
        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        await saveTestBrowserLogs(testInfo);
        cleanupCriticalErrorDetection();
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
        // Checking Configuration tab content
        await processorService.clickTab(customUIFrame, "Configuration");

        const _configContent = await customUIFrame
            .locator("#issuer-config")
            .textContent();
        // Configuration tab content found

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
            path: "target/test-results/comprehensive-tab-config.png",
            fullPage: true,
        });

        // Token Verification Tab
        // Checking Token Verification tab content
        await processorService.clickTab(customUIFrame, "Token Verification");

        const _tokenContent = await customUIFrame
            .locator("#token-verification")
            .textContent();
        // Token Verification tab content found

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
            path: "target/test-results/comprehensive-tab-token.png",
            fullPage: true,
        });

        // Metrics Tab
        // Checking Metrics tab content
        await processorService.clickTab(customUIFrame, "Metrics");

        const metricsContent = await customUIFrame
            .locator("#metrics")
            .textContent();
        // Metrics tab content found
        // Check for either the translated text or the i18n key
        expect(metricsContent).toMatch(
            /Validation Metrics|jwt\.validator\.metrics\.title|Total Validations/,
        );

        await page.screenshot({
            path: "target/test-results/comprehensive-tab-metrics.png",
            fullPage: true,
        });

        // Help Tab
        // Checking Help tab content
        await processorService.clickTab(customUIFrame, "Help");

        const helpContent = await customUIFrame.locator("#help").textContent();
        // Help tab content found
        // Check for either the translated text or the i18n key
        expect(helpContent).toMatch(
            /JWT Authenticator Help|jwt\.validator\.help\.title|Getting Started/,
        );

        await page.screenshot({
            path: "target/test-results/comprehensive-tab-help.png",
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
