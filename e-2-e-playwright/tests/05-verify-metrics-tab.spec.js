/**
 * @file Metrics Tab Test
 * Verifies the metrics tab functionality in the JWT authenticator UI
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

test.describe("Metrics Tab", () => {
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

    test("should display metrics dashboard", async ({ page }, testInfo) => {
        processorLogger.info("Testing metrics dashboard display");

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
            await processorService.clickTab(customUIFrame, "Metrics");

            const metricsPanel = await customUIFrame.locator(
                '[role="tabpanel"][data-tab="metrics"]',
            );
            await expect(metricsPanel).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Metrics tab panel displayed");

            const metricsSections = [
                {
                    selector: '[data-testid="validation-metrics"]',
                    description: "Validation Metrics",
                },
                {
                    selector: '[data-testid="issuer-metrics"]',
                    description: "Issuer Metrics",
                },
                {
                    selector: '[data-testid="performance-metrics"]',
                    description: "Performance Metrics",
                },
                {
                    selector: '[data-testid="error-metrics"]',
                    description: "Error Metrics",
                },
            ];

            for (const section of metricsSections) {
                const el = await customUIFrame.locator(section.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found ${section.description} section`);
            }

            processorLogger.success("Metrics dashboard displayed successfully");
        } catch (error) {
            processorLogger.error(
                `Error displaying metrics dashboard: ${error.message}`,
            );
            throw error;
        }
    });

    test("should show validation success and failure rates", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing validation rate metrics");

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
            await processorService.clickTab(customUIFrame, "Metrics");

            const validationMetrics = await customUIFrame.locator(
                '[data-testid="validation-metrics"]',
            );
            await expect(validationMetrics).toBeVisible({ timeout: 5000 });

            const successRate = await customUIFrame.locator(
                '[data-testid="success-rate"]',
            );
            await expect(successRate).toBeVisible({ timeout: 5000 });
            await expect(successRate).toContainText(/\d+(\.\d+)?%/);
            processorLogger.info("✓ Success rate displayed");

            const failureRate = await customUIFrame.locator(
                '[data-testid="failure-rate"]',
            );
            await expect(failureRate).toBeVisible({ timeout: 5000 });
            await expect(failureRate).toContainText(/\d+(\.\d+)?%/);
            processorLogger.info("✓ Failure rate displayed");

            const totalValidations = await customUIFrame.locator(
                '[data-testid="total-validations"]',
            );
            await expect(totalValidations).toBeVisible({ timeout: 5000 });
            await expect(totalValidations).toContainText(/\d+/);
            processorLogger.info("✓ Total validations count displayed");

            processorLogger.success(
                "Validation rate metrics displayed correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error displaying validation rates: ${error.message}`,
            );
            throw error;
        }
    });

    test("should display issuer-specific metrics", async ({
        page,
    }, testInfo) => {
        processorLogger.info("Testing issuer-specific metrics");

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
            await processorService.clickTab(customUIFrame, "Metrics");

            const issuerMetrics = await customUIFrame.locator(
                '[data-testid="issuer-metrics"]',
            );
            await expect(issuerMetrics).toBeVisible({ timeout: 5000 });

            const issuerTable = await customUIFrame.locator(
                '[data-testid="issuer-metrics-table"]',
            );
            await expect(issuerTable).toBeVisible({ timeout: 5000 });
            processorLogger.info("✓ Issuer metrics table displayed");

            const tableHeaders = [
                "Issuer",
                "Total Requests",
                "Success",
                "Failed",
                "Success Rate",
                "Avg Response Time",
            ];

            for (const header of tableHeaders) {
                const headerCell = await customUIFrame.locator(
                    `th:has-text("${header}")`,
                );
                await expect(headerCell).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ Found header: ${header}`);
            }

            const issuerRows = await customUIFrame.locator(
                '[data-testid="issuer-metrics-row"]',
            );
            const rowCount = await issuerRows.count();
            processorLogger.info(`Found ${rowCount} issuer metric rows`);

            if (rowCount > 0) {
                const firstRow = issuerRows.first();
                await expect(firstRow).toBeVisible({ timeout: 5000 });

                const issuerName = await firstRow.locator(
                    '[data-testid="issuer-name"]',
                );
                await expect(issuerName).toBeVisible();
                processorLogger.info("✓ Issuer metrics data displayed");
            }

            processorLogger.success(
                "Issuer-specific metrics displayed correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error displaying issuer metrics: ${error.message}`,
            );
            throw error;
        }
    });

    test("should show performance metrics", async ({ page }, testInfo) => {
        processorLogger.info("Testing performance metrics display");

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
            await processorService.clickTab(customUIFrame, "Metrics");

            const performanceMetrics = await customUIFrame.locator(
                '[data-testid="performance-metrics"]',
            );
            await expect(performanceMetrics).toBeVisible({ timeout: 5000 });

            const performanceIndicators = [
                {
                    selector: '[data-testid="avg-response-time"]',
                    description: "Average Response Time",
                    pattern: /\d+(\.\d+)?\s*ms/,
                },
                {
                    selector: '[data-testid="min-response-time"]',
                    description: "Min Response Time",
                    pattern: /\d+(\.\d+)?\s*ms/,
                },
                {
                    selector: '[data-testid="max-response-time"]',
                    description: "Max Response Time",
                    pattern: /\d+(\.\d+)?\s*ms/,
                },
                {
                    selector: '[data-testid="p95-response-time"]',
                    description: "P95 Response Time",
                    pattern: /\d+(\.\d+)?\s*ms/,
                },
            ];

            for (const indicator of performanceIndicators) {
                const el = await customUIFrame.locator(indicator.selector);
                await expect(el).toBeVisible({ timeout: 5000 });
                await expect(el).toContainText(indicator.pattern);
                processorLogger.info(`✓ ${indicator.description} displayed`);
            }

            processorLogger.success("Performance metrics displayed correctly");
        } catch (error) {
            processorLogger.error(
                `Error displaying performance metrics: ${error.message}`,
            );
            throw error;
        }
    });

    test("should refresh metrics data", async ({ page }, testInfo) => {
        processorLogger.info("Testing metrics refresh functionality");

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
            await processorService.clickTab(customUIFrame, "Metrics");

            const refreshButton = await customUIFrame.locator(
                '[data-testid="refresh-metrics-button"]',
            );
            await expect(refreshButton).toBeVisible({ timeout: 5000 });

            await refreshButton.click();
            processorLogger.info("Clicked refresh button");

            const refreshIndicator = await customUIFrame.locator(
                '[data-testid="refresh-indicator"]',
            );
            await expect(refreshIndicator).toBeVisible({ timeout: 2000 });
            processorLogger.info("✓ Refresh indicator displayed");

            await expect(refreshIndicator).not.toBeVisible({ timeout: 10000 });
            processorLogger.info("✓ Refresh completed");

            const lastUpdated = await customUIFrame.locator(
                '[data-testid="last-updated"]',
            );
            await expect(lastUpdated).toBeVisible({ timeout: 5000 });
            await expect(lastUpdated).toContainText(/Last updated:/i);
            processorLogger.success(
                "Metrics refresh functionality working correctly",
            );
        } catch (error) {
            processorLogger.error(
                `Error during metrics refresh test: ${error.message}`,
            );
            throw error;
        }
    });

    test("should export metrics data", async ({ page }, testInfo) => {
        processorLogger.info("Testing metrics export functionality");

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
            await processorService.clickTab(customUIFrame, "Metrics");

            const exportButton = await customUIFrame.locator(
                '[data-testid="export-metrics-button"]',
            );
            await expect(exportButton).toBeVisible({ timeout: 5000 });

            await exportButton.click();
            processorLogger.info("Clicked export button");

            const exportOptions = await customUIFrame.locator(
                '[data-testid="export-options"]',
            );
            await expect(exportOptions).toBeVisible({ timeout: 5000 });

            const exportFormats = ["CSV", "JSON", "Prometheus"];

            for (const format of exportFormats) {
                const formatOption = await customUIFrame.locator(
                    `[data-testid="export-${format.toLowerCase()}"]`,
                );
                await expect(formatOption).toBeVisible({ timeout: 5000 });
                processorLogger.info(`✓ ${format} export option available`);
            }

            processorLogger.success("Metrics export functionality verified");
        } catch (error) {
            processorLogger.error(
                `Error during metrics export test: ${error.message}`,
            );
            throw error;
        }
    });
});
