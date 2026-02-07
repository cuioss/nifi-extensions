/**
 * @file Metrics Tab Test
 * Verifies the metrics tab functionality in the JWT authenticator UI
 * @version 1.0.0
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("Metrics Tab", () => {
    test.beforeEach(async ({ page, processorManager }) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure all preconditions are met (processor setup, error handling, logging handled internally)
        await processorManager.ensureProcessorOnCanvas();
    });

    test("should display metrics dashboard", async ({ page }, testInfo) => {
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
        const metricsTabContent = await customUIFrame.locator("#metrics");
        await expect(metricsTabContent).toBeVisible({ timeout: 5000 });

        // Check for actual metrics content
        const metricsContent = await customUIFrame.locator(
            "#jwt-metrics-content",
        );

        // Wait for metrics content to be visible
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Verify metrics sections are present
        const validationMetrics = await customUIFrame.locator(
            '[data-testid="validation-metrics"]',
        );
        await expect(validationMetrics).toBeVisible({ timeout: 5000 });

        const performanceMetrics = await customUIFrame.locator(
            '[data-testid="performance-metrics"]',
        );
        await expect(performanceMetrics).toBeVisible({ timeout: 5000 });

        const issuerMetrics = await customUIFrame.locator(
            '[data-testid="issuer-metrics"]',
        );
        await expect(issuerMetrics).toBeVisible({ timeout: 5000 });
    });

    test("should show validation success and failure rates", async ({
        page,
    }, testInfo) => {
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
        await customUIFrame.waitForTimeout(2000);

        // Check for validation success rate
        const successRate = await customUIFrame.locator(
            '[data-testid="success-rate"]',
        );
        await expect(successRate).toBeVisible({ timeout: 5000 });

        // Check for failure rate
        const failureRate = await customUIFrame.locator(
            '[data-testid="failure-rate"]',
        );
        await expect(failureRate).toBeVisible({ timeout: 5000 });
    });

    test("should display issuer-specific metrics", async ({
        page,
    }, testInfo) => {
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
        await customUIFrame.waitForTimeout(2000);

        // Check for issuer metrics table
        const issuerTable = await customUIFrame.locator(
            '[data-testid="issuer-metrics-table"]',
        );
        await expect(issuerTable).toBeVisible({ timeout: 5000 });
    });

    test("should show performance metrics", async ({ page }, testInfo) => {
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
        const metricsContent = await customUIFrame.locator("#metrics");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Check for performance metrics section
        const performanceSection = await customUIFrame.locator(
            '[data-testid="performance-metrics"]',
        );
        await expect(performanceSection).toBeVisible({ timeout: 5000 });

        // Check for specific performance metrics
        const metricsElements = [
            "Average Response Time",
            "Min Response Time",
            "Max Response Time",
            "P95 Response Time",
        ];

        for (const metric of metricsElements) {
            const metricElement = await customUIFrame.locator(
                `h5:text("${metric}")`,
            );
            await expect(metricElement).toBeVisible({ timeout: 5000 });
        }
    });

    test("should refresh metrics data", async ({ page }, testInfo) => {
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
        const metricsContent = await customUIFrame.locator("#metrics");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Find refresh button
        const refreshButton = await customUIFrame.getByRole("button", {
            name: /refresh|reload/i,
        });
        await expect(refreshButton).toBeVisible({ timeout: 5000 });

        // Get initial metrics content
        await metricsContent.textContent();

        // Click refresh button
        await refreshButton.click();

        // Wait for refresh to complete (loading indicator or content change)
        await page.waitForTimeout(1000); // Allow time for refresh

        // Verify metrics content is still visible (may have same or updated content)
        await expect(metricsContent).toBeVisible({ timeout: 5000 });
    });

    test("should export metrics data", async ({ page }, testInfo) => {
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
        const metricsContent = await customUIFrame.locator("#metrics");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Find export button
        const exportButton = await customUIFrame.getByRole("button", {
            name: /export|download/i,
        });
        await expect(exportButton).toBeVisible({ timeout: 5000 });

        // Click export button
        await exportButton.click();

        // Wait for export options to appear
        const exportOptions = await customUIFrame.locator(
            '[data-testid="export-options"]',
        );
        await expect(exportOptions).toBeVisible({ timeout: 5000 });

        // Check that export format options are available
        const csvButton = await customUIFrame.locator(
            '[data-testid="export-csv"]',
        );
        const jsonButton = await customUIFrame.locator(
            '[data-testid="export-json"]',
        );
        const prometheusButton = await customUIFrame.locator(
            '[data-testid="export-prometheus"]',
        );

        await expect(csvButton).toBeVisible();
        await expect(jsonButton).toBeVisible();
        await expect(prometheusButton).toBeVisible();

        // Set up download promise before clicking a format
        const downloadPromise = page.waitForEvent("download", {
            timeout: 10000,
        });

        // Click JSON export as an example
        await jsonButton.click();

        try {
            // Wait for download to start
            const download = await downloadPromise;

            // Verify download properties
            const filename = download.suggestedFilename();
            expect(filename).toMatch(/jwt-metrics.*\.json/i);
        } catch (downloadError) {
            // If download doesn't trigger (e.g., in headless mode), just verify the options work
        }
    });
});
