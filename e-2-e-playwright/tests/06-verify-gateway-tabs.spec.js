/**
 * @file REST API Gateway Tabs Verification
 * Verifies the Custom UI displays gateway-specific tabs and content for
 * the RestApiGatewayProcessor. The gateway processor should show
 * Endpoint Configuration and Endpoint Tester tabs instead of JWT tabs.
 */

import {
    serialGatewayTest as test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { CONSTANTS } from "../utils/constants.js";
import { getValidAccessToken } from "../utils/keycloak-token-service.js";
import { assertNoAuthError } from "../utils/test-assertions.js";

test.describe("REST API Gateway Tabs", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should display gateway-specific tabs in custom UI", async ({
        page,
        customUIFrame,
    }, testInfo) => {
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

    test("should load gateway route CRUD editor with summary table", async ({
        page,
        customUIFrame,
    }, testInfo) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        // Verify the endpoint config panel is visible
        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Wait for the summary table to appear (list-first UX)
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Verify table has route data rows
        const tableRows = summaryTable.locator("tbody tr[data-route-name]");
        const rowCount = await tableRows.count();
        expect(rowCount).toBeGreaterThanOrEqual(1);

        // Verify "Add Route" button is visible
        const addRouteBtn = endpointConfigPanel.locator(".add-route-button");
        await expect(addRouteBtn).toBeVisible({ timeout: 5000 });

        // No inline edit form should be visible initially
        const routeForms = endpointConfigPanel.locator(".route-form");
        await expect(routeForms).toHaveCount(0);

        // Global settings section should show port info (populated async from properties)
        const globalSettingsTable = endpointConfigPanel.locator(".global-settings-display .config-table");
        const hasGlobalSettings = await globalSettingsTable.isVisible();
        if (hasGlobalSettings) {
            const settingsText = await globalSettingsTable.textContent();
            expect(settingsText).toMatch(/Listening Port/);
        }

        // Screenshot the endpoint config tab
        await page.screenshot({
            path: `${testInfo.outputDir}/gateway-endpoint-config.png`,
            fullPage: true,
        });
    });

    test("should display route summary table with correct columns", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Wait for summary table
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Verify table headers: Name, Path, Methods, Enabled, Actions
        const headers = summaryTable.locator("thead th");
        await expect(headers).toHaveCount(5);
        await expect(headers.nth(0)).toContainText("Name");
        await expect(headers.nth(1)).toContainText("Path");
        await expect(headers.nth(2)).toContainText("Methods");
        await expect(headers.nth(3)).toContainText("Enabled");
        await expect(headers.nth(4)).toContainText("Actions");

        // Verify at least one data row exists
        const dataRows = summaryTable.locator("tbody tr[data-route-name]");
        const rowCount = await dataRows.count();
        expect(rowCount).toBeGreaterThanOrEqual(1);
    });

    test("should open inline editor when clicking Edit", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Wait for summary table
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Click Edit on first row
        const firstEditBtn = summaryTable.locator(".edit-route-button").first();
        await expect(firstEditBtn).toBeVisible({ timeout: 5000 });
        await firstEditBtn.click();

        // Verify inline editor form appears
        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Verify form has populated fields
        const routeName = routeForm.locator(".route-name");
        await expect(routeName).toBeVisible({ timeout: 5000 });
        const nameValue = await routeName.inputValue();
        expect(nameValue.length).toBeGreaterThan(0);

        const pathField = routeForm.locator(".field-path");
        await expect(pathField).toBeVisible({ timeout: 5000 });

        const methodsField = routeForm.locator(".field-methods");
        await expect(methodsField).toBeVisible({ timeout: 5000 });

        const enabledCheckbox = routeForm.locator(".route-enabled");
        await expect(enabledCheckbox).toBeVisible({ timeout: 5000 });

        // Verify Save and Cancel buttons
        const saveBtn = routeForm.locator(".save-route-button");
        await expect(saveBtn).toBeVisible({ timeout: 5000 });
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await expect(cancelBtn).toBeVisible({ timeout: 5000 });
    });

    test("should cancel editing and return to table row", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Wait for summary table
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Close any leftover editor from previous test
        const existingForm = endpointConfigPanel.locator(".route-form");
        if (await existingForm.count() > 0) {
            const existingCancel = existingForm.locator(".cancel-route-button");
            if (await existingCancel.isVisible({ timeout: 1000 }).catch(() => false)) {
                await existingCancel.click();
                await expect(existingForm).toHaveCount(0, { timeout: 3000 });
            }
        }

        // Remember initial row count
        const initialRows = summaryTable.locator("tbody tr[data-route-name]:not(.hidden)");
        const initialCount = await initialRows.count();

        // Click Edit on first visible row
        const firstEditBtn = summaryTable.locator("tbody tr[data-route-name]:not(.hidden) .edit-route-button").first();
        await expect(firstEditBtn).toBeVisible({ timeout: 5000 });
        await firstEditBtn.click();

        // Form is open
        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Click Cancel
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();

        // Form disappears
        await expect(routeForm).toHaveCount(0);

        // Table row count is restored
        const restoredRows = summaryTable.locator("tbody tr[data-route-name]:not(.hidden)");
        const restoredCount = await restoredRows.count();
        expect(restoredCount).toBe(initialCount);
    });

    test("should add new route with empty form", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Wait for summary table
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Click Add Route
        const addRouteBtn = endpointConfigPanel.locator(".add-route-button");
        await addRouteBtn.click();

        // Verify form appears with empty fields
        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        const routeName = routeForm.locator(".route-name");
        const nameValue = await routeName.inputValue();
        expect(nameValue).toBe("");

        const pathField = routeForm.locator(".field-path");
        const pathValue = await pathField.inputValue();
        expect(pathValue).toBe("");
    });

    test("should cancel new route and remove form", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Wait for summary table
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Click Add Route
        const addRouteBtn = endpointConfigPanel.locator(".add-route-button");
        await addRouteBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Click Cancel
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();

        // Form removed entirely
        await expect(routeForm).toHaveCount(0);
    });

    test("should toggle schema textarea via checkbox", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Wait for summary table
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Open editor for first route
        const firstEditBtn = summaryTable.locator(".edit-route-button").first();
        await firstEditBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Schema checkbox should exist
        const schemaCheckbox = routeForm.locator(".schema-validation-checkbox");
        await expect(schemaCheckbox).toBeVisible({ timeout: 5000 });

        // Schema container should be hidden by default (route likely has no schema)
        const schemaContainer = routeForm.locator(".field-container-schema");
        await expect(schemaContainer).toBeHidden();

        // Check the checkbox — schema textarea becomes visible
        await schemaCheckbox.check();
        await expect(schemaContainer).toBeVisible({ timeout: 3000 });

        // Uncheck — hidden again
        await schemaCheckbox.uncheck();
        await expect(schemaContainer).toBeHidden();
    });

    test("should display endpoint tester with route selector and controls", async ({
        customUIFrame,
        processorService,
    }) => {
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
        customUIFrame,
        processorService,
    }) => {
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
        customUIFrame,
        processorService,
    }) => {
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
        customUIFrame,
        processorService,
    }) => {
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

    test("should show error when sending request without route selection", async ({
        customUIFrame,
        processorService,
    }) => {
        // Navigate to Endpoint Tester tab
        await processorService.clickTab(customUIFrame, "Endpoint Tester");

        const endpointTesterPanel = customUIFrame.locator("#endpoint-tester");
        await expect(endpointTesterPanel).toBeVisible({ timeout: 5000 });

        // Clear route selector to have no route selected
        const routeSelector = endpointTesterPanel.locator(".route-selector");
        await expect(routeSelector).toBeVisible({ timeout: 5000 });
        // Deselect all options (no placeholder may exist in shared-page context)
        await routeSelector.evaluate(el => {
            el.selectedIndex = -1;
            el.dispatchEvent(new Event("change", { bubbles: true }));
        });

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
        customUIFrame,
        processorService,
    }) => {
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
        customUIFrame,
        processorService,
    }) => {
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
        customUIFrame,
        processorService,
    }) => {
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
        customUIFrame,
        processorService,
    }) => {
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
        customUIFrame,
        processorService,
    }, testInfo) => {
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
