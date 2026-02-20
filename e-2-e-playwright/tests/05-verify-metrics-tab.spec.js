/**
 * @file Metrics Tab Test
 * Verifies the metrics tab functionality in the JWT authenticator UI.
 *
 * The JWT authenticator processor uses the non-gateway metrics template which
 * shows a "Metrics Not Available" banner (metrics are REST API Gateway only).
 * These tests verify that the metrics tab renders correctly, shows the
 * not-available banner, and that the refresh/export controls are functional.
 * @version 1.2.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("Metrics Tab", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should display not-available banner with gateway requirement message", async ({
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
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();
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
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();
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

    test("should refresh metrics data", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        await processorService.clickTab(customUIFrame, "Metrics");

        // Wait for metrics to load
        const metricsContent = customUIFrame.locator("#metrics");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Find refresh button
        const refreshButton = customUIFrame.getByRole("button", {
            name: /refresh|reload/i,
        });
        await expect(refreshButton).toBeVisible({ timeout: 5000 });

        // Click refresh and verify the button is functional (not disabled, no errors)
        await refreshButton.click();

        // Wait for any pending operations to complete
        await page.waitForLoadState("networkidle");

        // Verify metrics content remains visible and stable after refresh
        await expect(metricsContent).toBeVisible({ timeout: 5000 });

        // Verify last-updated element is still present (refresh didn't break the UI)
        const lastUpdated = customUIFrame.locator('[data-testid="last-updated"]');
        await expect(lastUpdated).toBeVisible({ timeout: 5000 });
        await expect(lastUpdated).toContainText("Last updated:");
    });

    test("should export metrics data", async ({ page }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find JWT processor
        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        // Open Advanced UI
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();
        await processorService.clickTab(customUIFrame, "Metrics");

        // Wait for metrics to load
        const metricsContent = customUIFrame.locator("#metrics");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Find export button
        const exportButton = customUIFrame.getByRole("button", {
            name: /export|download/i,
        });
        await expect(exportButton).toBeVisible({ timeout: 5000 });

        // Click export button
        await exportButton.click();

        // Wait for export options to appear
        const exportOptions = customUIFrame.locator(
            '[data-testid="export-options"]',
        );
        await expect(exportOptions).toBeVisible({ timeout: 5000 });

        // Check that export format options are available
        const csvButton = customUIFrame.locator('[data-testid="export-csv"]');
        const jsonButton = customUIFrame.locator('[data-testid="export-json"]');
        const prometheusButton = customUIFrame.locator(
            '[data-testid="export-prometheus"]',
        );

        await expect(csvButton).toBeVisible();
        await expect(jsonButton).toBeVisible();
        await expect(prometheusButton).toBeVisible();

        // Click JSON export and verify a download is triggered
        const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
        await jsonButton.click();
        const download = await downloadPromise;

        // Verify the download has a meaningful filename
        expect(download.suggestedFilename()).toMatch(/\.json$/i);
    });
});
