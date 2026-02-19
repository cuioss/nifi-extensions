/**
 * @file Verify JWT Custom UI Tab Content
 * Verifies the content functionality of each tab in the JWT authenticator custom UI
 * @version 1.1.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("JWT Custom UI Tab Content", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should verify tab content functionality", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame");
        }

        // Configuration tab (should be active by default)
        const addIssuerButton = customUIFrame.locator(
            'button:has-text("Add Issuer")',
        );
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });

        // Token Verification tab
        const tokenVerificationTab = customUIFrame.locator(
            'a[href="#token-verification"]',
        );
        await expect(tokenVerificationTab).toBeVisible({ timeout: 5000 });
        await tokenVerificationTab.click();

        const verifyButton = customUIFrame
            .locator('button:has-text("Verify Token")')
            .first();
        await expect(verifyButton).toBeVisible({ timeout: 5000 });

        // Metrics tab
        const metricsTab = customUIFrame.locator('a[href="#metrics"]');
        await expect(metricsTab).toBeVisible({ timeout: 5000 });
        await metricsTab.click();

        const metricsContent = customUIFrame.locator("#metrics").first();
        await expect(metricsContent).toBeVisible({ timeout: 5000 });

        // Help tab
        const helpTab = customUIFrame.locator('a[href="#help"]');
        await expect(helpTab).toBeVisible({ timeout: 5000 });
        await helpTab.click();

        const helpContent = customUIFrame.locator("#help").first();
        await expect(helpContent).toBeVisible({ timeout: 5000 });

        // Verify the Help tab title is properly translated (not showing the i18n key)
        const helpTitle = customUIFrame.locator("#help h3, #help h2").first();
        const helpTitleText = await helpTitle.textContent();
        expect(helpTitleText).not.toContain("jwt.validator.help.title");
        expect(helpTitleText).toMatch(
            /Component Help|JWT Authenticator Help|JWT-Authentifikator-Hilfe/,
        );

        // Go back to Metrics tab to verify its title
        await metricsTab.click();

        const metricsTitle = customUIFrame
            .locator("#metrics h3, #metrics h2")
            .first();
        await expect(metricsTitle).toBeVisible({ timeout: 5000 });
        const metricsTitleText = await metricsTitle.textContent();
        expect(metricsTitleText).not.toContain("jwt.validator.metrics.title");
        expect(metricsTitleText).toMatch(
            /JWT Validation Metrics|JWT-Validierungsmetriken/,
        );
    });
});
