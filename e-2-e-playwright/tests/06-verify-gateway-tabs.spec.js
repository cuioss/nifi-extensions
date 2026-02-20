/**
 * @file REST API Gateway Tabs Verification
 * Verifies the Custom UI displays gateway-specific tabs and content for
 * the RestApiGatewayProcessor. The gateway processor should show
 * Endpoint Configuration and Endpoint Tester tabs instead of JWT tabs.
 */

import {
    gatewayTest as test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";
import { PROCESSOR_TYPES } from "../utils/constants.js";
import { getValidAccessToken } from "../utils/keycloak-token-service.js";
import { assertNoAuthError } from "../utils/test-assertions.js";

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

        // Verify actual content: Global Settings section
        const globalSettingsHeader = endpointConfigPanel.locator("h3").filter({ hasText: "Global Settings" });
        await expect(globalSettingsHeader).toBeVisible({ timeout: 5000 });

        // Config table must be rendered
        const configTable = endpointConfigPanel.locator(".config-table").first();
        await expect(configTable).toBeVisible({ timeout: 5000 });

        // Routes section header must be present
        const routesHeader = endpointConfigPanel.locator("h3").filter({ hasText: "Routes" });
        await expect(routesHeader).toBeVisible({ timeout: 5000 });

        // Screenshot the endpoint config tab
        await page.screenshot({
            path: `${testInfo.outputDir}/gateway-endpoint-config.png`,
            fullPage: true,
        });
    });

    test("should display endpoint tester with route selector and controls", async ({
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

        // Navigate to Endpoint Tester tab
        await processorService.clickTab(customUIFrame, "Endpoint Tester");

        // Verify the endpoint tester panel is visible
        const endpointTesterPanel = customUIFrame.locator("#endpoint-tester");
        await expect(endpointTesterPanel).toBeVisible({ timeout: 5000 });

        // Verify route selector exists
        const routeSelector = endpointTesterPanel.locator(".route-selector");
        await expect(routeSelector).toBeVisible({ timeout: 5000 });

        // Verify method selector exists
        const methodSelector = endpointTesterPanel.locator(".method-selector");
        await expect(methodSelector).toBeVisible({ timeout: 5000 });

        // Verify token input exists
        const tokenInput = endpointTesterPanel.locator(".token-input");
        await expect(tokenInput).toBeVisible({ timeout: 5000 });

        // Verify send request button exists
        const sendButton = endpointTesterPanel.locator(".send-request-button");
        await expect(sendButton).toBeVisible({ timeout: 5000 });

        // Response display should be initially hidden
        const responseDisplay = endpointTesterPanel.locator(".response-display");
        await expect(responseDisplay).toBeHidden();
    });

    test("should send request via endpoint tester and display response", async ({
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

        // Navigate to Endpoint Tester tab
        await processorService.clickTab(customUIFrame, "Endpoint Tester");

        const endpointTesterPanel = customUIFrame.locator("#endpoint-tester");
        await expect(endpointTesterPanel).toBeVisible({ timeout: 5000 });

        // Fill in the token input with a valid Keycloak token
        const tokenInput = endpointTesterPanel.locator(".token-input");
        await expect(tokenInput).toBeVisible({ timeout: 5000 });
        const validToken = await getValidAccessToken();
        await tokenInput.fill(validToken);

        // Click Send Request
        const sendButton = endpointTesterPanel.locator(".send-request-button");
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();

        // Wait for response display to appear
        const responseDisplay = endpointTesterPanel.locator(".response-display");
        await expect(responseDisplay).toBeVisible({ timeout: 30000 });

        const responseText = await responseDisplay.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(responseText);

        // Response should contain HTTP status information
        expect(responseText).toMatch(/\d{3}|status|response/i);
    });

    test("should send POST request with body via endpoint tester", async ({
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

        // Navigate to Endpoint Tester tab
        await processorService.clickTab(customUIFrame, "Endpoint Tester");

        const endpointTesterPanel = customUIFrame.locator("#endpoint-tester");
        await expect(endpointTesterPanel).toBeVisible({ timeout: 5000 });

        // Select POST method
        const methodSelector = endpointTesterPanel.locator(".method-selector");
        await methodSelector.selectOption("POST");

        // Verify body textarea becomes visible
        const bodyGroup = endpointTesterPanel.locator(".body-group");
        await expect(bodyGroup).toBeVisible({ timeout: 5000 });

        const bodyInput = endpointTesterPanel.locator(".body-input");
        await expect(bodyInput).toBeVisible({ timeout: 5000 });

        // Fill body with JSON
        await bodyInput.fill('{"test":"data"}');

        // Fill in a valid token
        const tokenInput = endpointTesterPanel.locator(".token-input");
        const validToken = await getValidAccessToken();
        await tokenInput.fill(validToken);

        // Click Send Request
        const sendButton = endpointTesterPanel.locator(".send-request-button");
        await sendButton.click();

        // Wait for response display to appear
        const responseDisplay = endpointTesterPanel.locator(".response-display");
        await expect(responseDisplay).toBeVisible({ timeout: 30000 });

        const responseText = await responseDisplay.textContent();

        // Must not be an auth/CSRF infrastructure error
        assertNoAuthError(responseText);

        // Response should contain HTTP status information
        expect(responseText).toMatch(/\d{3}|status|response/i);
    });

    test("should display metrics for gateway processor with actual content", async ({
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

        // Verify actual metrics content is rendered (not just empty)
        const metricsText = await metricsContent.textContent();
        expect(metricsText.length).toBeGreaterThan(50);

        // Verify at least one gateway-specific metrics section is visible
        const tokenValidation = customUIFrame.locator(
            '[data-testid="token-validation-metrics"]',
        );
        const httpSecurity = customUIFrame.locator(
            '[data-testid="http-security-metrics"]',
        );
        const gatewayEvents = customUIFrame.locator(
            '[data-testid="gateway-events-metrics"]',
        );

        const hasTokenValidation = await tokenValidation.isVisible();
        const hasHttpSecurity = await httpSecurity.isVisible();
        const hasGatewayEvents = await gatewayEvents.isVisible();

        expect(
            hasTokenValidation || hasHttpSecurity || hasGatewayEvents,
        ).toBe(true);

        // Verify "Last updated" status is present for gateway metrics
        const lastUpdated = customUIFrame.locator('[data-testid="last-updated"]');
        await expect(lastUpdated).toBeVisible({ timeout: 5000 });
        await expect(lastUpdated).toContainText("Last updated:");
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
