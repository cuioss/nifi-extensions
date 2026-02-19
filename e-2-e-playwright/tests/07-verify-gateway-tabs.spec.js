/**
 * @file REST API Gateway Tabs Verification
 * Verifies the Custom UI displays gateway-specific tabs and content for
 * the RestApiGatewayProcessor. The gateway processor should show
 * Endpoint Configuration and Endpoint Tester tabs instead of JWT tabs.
 * @version 1.1.0
 */

import {
    gatewayTest as test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { PROCESSOR_TYPES } from "../utils/constants.js";

test.describe("REST API Gateway Tabs", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        // Ensure gateway processor preconditions are met
        await processorManager.ensureGatewayProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should display gateway-specific tabs in custom UI", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        // Find gateway processor on canvas
        const processor = await processorService.find(
            PROCESSOR_TYPES.REST_API_GATEWAY,
            { failIfNotFound: true },
        );

        // Open Advanced UI
        await processorService.openAdvancedUI(processor);

        // Get the custom UI frame
        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame for gateway processor");
        }

        // Take screenshot of the gateway custom UI
        await page.screenshot({
            path: `${testInfo.outputDir}/gateway-custom-ui-tabs.png`,
            fullPage: true,
        });

        // Check for tab container
        const tabContainer = customUIFrame.locator(
            '[data-testid="jwt-config-tabs"]',
        );
        await expect(tabContainer).toBeVisible({ timeout: 5000 });

        // Gateway processor should show Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });

        // Metrics tab should be present for gateway
        const metricsTab = customUIFrame.locator('a[href="#metrics"]');
        await expect(metricsTab).toBeVisible({ timeout: 5000 });

        // Help tab should be present
        const helpTab = customUIFrame.locator('a[href="#help"]');
        await expect(helpTab).toBeVisible({ timeout: 5000 });
    });

    test("should load gateway config from /gateway/config endpoint", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.find(
            PROCESSOR_TYPES.REST_API_GATEWAY,
            { failIfNotFound: true },
        );

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame");
        }

        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        // Verify the endpoint config panel is visible
        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Screenshot the endpoint config tab
        await page.screenshot({
            path: `${testInfo.outputDir}/gateway-endpoint-config.png`,
            fullPage: true,
        });
    });

    test("should display metrics for gateway processor without not-available banner", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.find(
            PROCESSOR_TYPES.REST_API_GATEWAY,
            { failIfNotFound: true },
        );

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame");
        }

        // Click Metrics tab
        await processorService.clickTab(customUIFrame, "Metrics");

        // Wait for metrics content
        const metricsContent = customUIFrame.locator("#metrics");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // For gateway processor, metrics should NOT show "Metrics Not Available"
        const notAvailableBanner = customUIFrame.locator(
            "text=Metrics Not Available",
        );
        await expect(notAvailableBanner).not.toBeVisible({ timeout: 3000 });

        // Take screenshot of gateway metrics
        await page.screenshot({
            path: `${testInfo.outputDir}/gateway-metrics.png`,
            fullPage: true,
        });
    });

    test("should display gateway-specific help content", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.find(
            PROCESSOR_TYPES.REST_API_GATEWAY,
            { failIfNotFound: true },
        );

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Failed to get custom UI frame");
        }

        // Click Help tab
        await processorService.clickTab(customUIFrame, "Help");

        // Wait for help content
        const helpContent = customUIFrame.locator("#help");
        await expect(helpContent).toBeVisible({ timeout: 5000 });

        // Screenshot help tab for gateway
        await page.screenshot({
            path: `${testInfo.outputDir}/gateway-help.png`,
            fullPage: true,
        });

        // Help title should not show i18n keys
        const helpTitle = customUIFrame.locator("#help h3, #help h2").first();
        const helpTitleText = await helpTitle.textContent();
        expect(helpTitleText).not.toContain("jwt.validator.help.title");
    });
});
