/**
 * @file Metrics Tab Test
 * Verifies the metrics tab functionality in the JWT authenticator UI.
 *
 * The JWT authenticator processor uses the non-gateway metrics template which
 * shows a "Metrics Not Available" banner (metrics are REST API Gateway only).
 * These tests verify that the metrics tab renders correctly and shows the
 * not-available banner. Refresh/export tests live in 06-verify-gateway-tabs.spec.js
 * where metrics contain real data.
 * @version 1.3.0
 */

import {
    serialTest as test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";

test.describe("Metrics Tab", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should display not-available banner with gateway requirement message", async ({
        customUIFrame,
        processorService,
    }) => {
        await processorService.clickTab(customUIFrame, "Metrics");

        // Check for metrics dashboard content
        const metricsTabContent = customUIFrame.locator("#metrics");
        await expect(metricsTabContent).toBeVisible({ timeout: 5000 });

        // Check for metrics content container
        const metricsContent = customUIFrame.locator("#jwt-metrics-content");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // JWT authenticator shows "Metrics Not Available" banner
        const notAvailableBanner = customUIFrame.locator(
            "text=Metrics Not Available",
        );
        await expect(notAvailableBanner).toBeVisible({ timeout: 5000 });

        // Verify the banner explains that metrics are gateway-only
        const gatewayMessage = customUIFrame.locator(
            "text=Metrics are available for REST API Gateway processors only",
        );
        await expect(gatewayMessage).toBeVisible({ timeout: 5000 });
    });

    test("should not display gateway-specific metrics sections for JWT processor", async ({
        customUIFrame,
        processorService,
    }) => {
        await processorService.clickTab(customUIFrame, "Metrics");

        // Wait for metrics content to render
        const metricsContent = customUIFrame.locator("#jwt-metrics-content");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Gateway-specific sections should NOT be present for JWT authenticator
        const tokenValidation = customUIFrame.locator(
            '[data-testid="token-validation-metrics"]',
        );
        await expect(tokenValidation).not.toBeVisible();

        const httpSecurity = customUIFrame.locator(
            '[data-testid="http-security-metrics"]',
        );
        await expect(httpSecurity).not.toBeVisible();

        const gatewayEvents = customUIFrame.locator(
            '[data-testid="gateway-events-metrics"]',
        );
        await expect(gatewayEvents).not.toBeVisible();
    });

    test("should display last-updated status in metrics tab", async ({
        customUIFrame,
        processorService,
    }) => {
        await processorService.clickTab(customUIFrame, "Metrics");

        // Verify last-updated status is present
        const lastUpdated = customUIFrame.locator(
            '[data-testid="last-updated"]',
        );
        await expect(lastUpdated).toBeVisible({ timeout: 5000 });
        await expect(lastUpdated).toContainText("Last updated:");

        // Verify the Metrics tab title is properly translated (not showing the i18n key)
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
