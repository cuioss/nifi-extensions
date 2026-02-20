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
import { PROCESSOR_TYPES, CONSTANTS } from "../utils/constants.js";
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

        // All gateway-specific metrics sections must be visible
        const tokenValidation = customUIFrame.locator(
            '[data-testid="token-validation-metrics"]',
        );
        const httpSecurity = customUIFrame.locator(
            '[data-testid="http-security-metrics"]',
        );
        const gatewayEvents = customUIFrame.locator(
            '[data-testid="gateway-events-metrics"]',
        );

        await expect(tokenValidation).toBeVisible({ timeout: 5000 });
        await expect(httpSecurity).toBeVisible({ timeout: 5000 });
        await expect(gatewayEvents).toBeVisible({ timeout: 5000 });

        // Verify "Last updated" status is present for gateway metrics
        const lastUpdated = customUIFrame.locator('[data-testid="last-updated"]');
        await expect(lastUpdated).toBeVisible({ timeout: 5000 });
        await expect(lastUpdated).toContainText("Last updated:");
    });

    test("should display route details and global settings in endpoint config", async ({
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

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Verify Global Settings config table shows port and protocol info
        const globalSettingsSection = endpointConfigPanel.locator(".config-table").first();
        await expect(globalSettingsSection).toBeVisible({ timeout: 5000 });
        const settingsText = await globalSettingsSection.textContent();
        expect(settingsText.length).toBeGreaterThan(20);

        // Verify the config panel has meaningful content beyond just headers
        const panelText = await endpointConfigPanel.textContent();
        expect(panelText).toMatch(/Global Settings/);
        expect(panelText).toMatch(/Routes/);
        // The panel should contain actual configuration data (port numbers, paths, etc.)
        expect(panelText.length).toBeGreaterThan(100);
    });

    test("should show error when sending request without route selection", async ({
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

        // Clear route selector to have no route selected
        const routeSelector = endpointTesterPanel.locator(".route-selector");
        await expect(routeSelector).toBeVisible({ timeout: 5000 });
        await routeSelector.selectOption({ index: 0 }); // Select placeholder/empty option

        // Click Send Request without selecting a route
        const sendButton = endpointTesterPanel.locator(".send-request-button");
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();

        // Expect either a validation error or a response indicating the issue
        // The UI may show an inline error, a response display error, or keep the send button disabled
        const errorIndicator = endpointTesterPanel.locator(
            ".error-message, .validation-error, .alert-danger, [role='alert'], .response-display",
        );
        await expect(errorIndicator).toBeVisible({ timeout: 10000 });

        const indicatorText = await errorIndicator.textContent();
        // Should indicate missing route or error — not a successful response
        expect(indicatorText).toMatch(/route|select|error|required|invalid|400|404/i);
    });

    test("should reject request with expired token via endpoint tester", async ({
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

        // Select a valid route (first real option after placeholder)
        const routeSelector = endpointTesterPanel.locator(".route-selector");
        await expect(routeSelector).toBeVisible({ timeout: 5000 });
        const options = routeSelector.locator("option");
        const optionCount = await options.count();
        if (optionCount > 1) {
            await routeSelector.selectOption({ index: 1 });
        }

        // Fill token input with an expired token
        const tokenInput = endpointTesterPanel.locator(".token-input");
        await expect(tokenInput).toBeVisible({ timeout: 5000 });
        await tokenInput.fill(CONSTANTS.TEST_TOKENS.EXPIRED);

        // Click Send Request
        const sendButton = endpointTesterPanel.locator(".send-request-button");
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();

        // Wait for response display — gateway should reject expired token
        const responseDisplay = endpointTesterPanel.locator(
            ".response-display, .error-message, [role='alert']",
        );
        await expect(responseDisplay).toBeVisible({ timeout: 30000 });

        const responseText = await responseDisplay.textContent();

        // Must indicate auth failure (401, expired, unauthorized, invalid, etc.)
        expect(responseText).toMatch(
            /401|expired|unauthorized|invalid|authentication|forbidden|error/i,
        );

        // Must NOT show a successful 2xx response
        expect(responseText).not.toMatch(/\b2\d{2}\b.*OK/i);
    });

    test("should reject request without authentication token", async ({
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

        // Leave token input empty — no authentication
        const tokenInput = endpointTesterPanel.locator(".token-input");
        await expect(tokenInput).toBeVisible({ timeout: 5000 });
        await tokenInput.fill("");

        // Select a valid route (first real option after placeholder)
        const routeSelector = endpointTesterPanel.locator(".route-selector");
        await expect(routeSelector).toBeVisible({ timeout: 5000 });
        const options = routeSelector.locator("option");
        const optionCount = await options.count();
        // Select the first non-placeholder option (index 1 if placeholder exists)
        if (optionCount > 1) {
            await routeSelector.selectOption({ index: 1 });
        }

        // Click Send Request without a token
        const sendButton = endpointTesterPanel.locator(".send-request-button");
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();

        // Wait for response display — gateway should reject unauthenticated request
        const responseDisplay = endpointTesterPanel.locator(
            ".response-display, .error-message, [role='alert']",
        );
        await expect(responseDisplay).toBeVisible({ timeout: 30000 });

        const responseText = await responseDisplay.textContent();

        // Must indicate auth failure (401, unauthorized, missing token, etc.)
        expect(responseText).toMatch(
            /401|unauthorized|missing|token|authentication|forbidden|error/i,
        );

        // Must NOT show a successful 2xx response
        expect(responseText).not.toMatch(/\b2\d{2}\b.*OK/i);
    });

    test("should refresh gateway metrics and update timestamp", async ({
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

        // Wait for metrics to load
        const metricsContent = customUIFrame.locator("#metrics");
        await expect(metricsContent).toBeVisible({ timeout: 10000 });

        // Capture the last-updated element before refresh
        const lastUpdated = customUIFrame.locator('[data-testid="last-updated"]');
        await expect(lastUpdated).toBeVisible({ timeout: 5000 });
        const timestampBefore = await lastUpdated.textContent();

        // Find refresh button
        const refreshButton = customUIFrame.getByRole("button", {
            name: /refresh|reload/i,
        });
        await expect(refreshButton).toBeVisible({ timeout: 5000 });

        // Wait 1.1s so the timestamp will differ (second-level granularity)
        await page.waitForTimeout(1100);

        // Click refresh
        await refreshButton.click();

        // Wait for refresh to complete
        await page.waitForLoadState("networkidle");

        // Verify metrics content remains visible and stable after refresh
        await expect(metricsContent).toBeVisible({ timeout: 5000 });

        // Verify last-updated element is still present (refresh didn't break the UI)
        await expect(lastUpdated).toBeVisible({ timeout: 5000 });
        const timestampAfter = await lastUpdated.textContent();

        // Gateway metrics are real — timestamp should have changed after refresh
        expect(timestampAfter).toContain("Last updated:");
        if (!timestampBefore.includes("Never")) {
            expect(timestampAfter).not.toBe(timestampBefore);
        }
    });

    test("should export gateway metrics in JSON format", async ({
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

        // Validate actual help content — not just absence of i18n keys
        const helpText = await helpContent.textContent();
        expect(helpText.length).toBeGreaterThan(100);

        // Help content should mention gateway-relevant keywords
        const lowerHelp = helpText.toLowerCase();
        const hasRelevantKeywords =
            lowerHelp.includes("rest api gateway") ||
            lowerHelp.includes("endpoint") ||
            lowerHelp.includes("route") ||
            lowerHelp.includes("authentication");
        expect(hasRelevantKeywords).toBe(true);

        // Help content should have structured sections (headings or distinct content blocks)
        const helpSections = helpContent.locator("h3, h4, h5, .help-section, section");
        const sectionCount = await helpSections.count();
        expect(sectionCount).toBeGreaterThanOrEqual(1);
    });
});
