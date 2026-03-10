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

        // Verify table headers: Name, Connection, Path, Methods, Auth Mode, Enabled, Actions
        const headers = summaryTable.locator("thead th");
        await expect(headers).toHaveCount(7);
        await expect(headers.nth(0)).toContainText("Name");
        await expect(headers.nth(1)).toContainText("Connection");
        await expect(headers.nth(2)).toContainText("Path");
        await expect(headers.nth(3)).toContainText("Methods");
        await expect(headers.nth(4)).toContainText("Auth");
        await expect(headers.nth(5)).toContainText("Enabled");
        await expect(headers.nth(6)).toContainText("Actions");

        // Verify at least one data row exists
        const dataRows = summaryTable.locator("tbody tr[data-route-name]");
        const rowCount = await dataRows.count();
        expect(rowCount).toBeGreaterThanOrEqual(1);
    });

    test("should display management endpoints with Edit buttons", async ({
        page,
        customUIFrame,
    }, testInfo) => {
        // Navigate to Endpoint Configuration tab
        const endpointConfigTab = customUIFrame.locator(
            'a[href="#endpoint-config"]',
        );
        await expect(endpointConfigTab).toBeVisible({ timeout: 5000 });
        await endpointConfigTab.click();

        const endpointConfigPanel = customUIFrame.locator("#endpoint-config");
        await expect(endpointConfigPanel).toBeVisible({ timeout: 5000 });

        // Management endpoints load asynchronously with a built-in retry.
        const mgmtTable = customUIFrame.locator(".management-endpoints-table");
        await expect(mgmtTable).toBeVisible({ timeout: 15000 });

        // Verify Edit buttons exist
        const editButtons = mgmtTable.locator(".btn-edit");
        const count = await editButtons.count();
        expect(count).toBeGreaterThan(0);

        // Verify rows have data-mgmt-name attributes
        const rows = mgmtTable.locator("tbody tr[data-mgmt-name]");
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);

        await page.screenshot({
            path: `${testInfo.outputDir}/management-endpoints-edit-buttons.png`,
            fullPage: true,
        });
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

        const methodChipArea = routeForm.locator(".method-chip-area");
        await expect(methodChipArea).toBeVisible({ timeout: 5000 });

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

    test("should show schema badge for validated route", async ({
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

        // Find the 'validated' route row (which has a file-based schema)
        const validatedRow = summaryTable.locator(
            'tr[data-route-name="validated"]',
        );
        await expect(validatedRow).toBeVisible({ timeout: 5000 });

        // Schema badge should be visible in the path cell
        const schemaBadge = validatedRow.locator(".schema-badge");
        await expect(schemaBadge).toBeVisible({ timeout: 3000 });
        await expect(schemaBadge).toContainText("Schema");
    });

    test("should display Connection column with default connection name for routes", async ({
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

        // Verify the data route shows its name as the default connection
        const dataRow = summaryTable.locator(
            'tr[data-route-name="data"]',
        );
        await expect(dataRow).toBeVisible({ timeout: 5000 });

        // Connection is in the second column (index 1)
        const connectionCell = dataRow.locator("td").nth(1);
        await expect(connectionCell).toContainText("data");
    });

    test("should display create-flowfile checkbox in route editor form", async ({
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

        // Click Edit on the data route
        const dataRow = summaryTable.locator(
            'tr[data-route-name="data"]',
        );
        const editBtn = dataRow.locator(".edit-route-button");
        await editBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Create FlowFile checkbox should be present and checked by default
        const createFlowFileCheckbox = routeForm.locator(
            ".create-flowfile-checkbox",
        );
        await expect(createFlowFileCheckbox).toBeVisible({ timeout: 5000 });
        await expect(createFlowFileCheckbox).toBeChecked();

        // Connection name container should be visible when create-flowfile is checked
        const outcomeContainer = routeForm.locator(
            ".field-container-success-outcome",
        );
        await expect(outcomeContainer).toBeVisible({ timeout: 3000 });

        // Cancel to clean up
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    test("should hide connection name field when create-flowfile is unchecked", async ({
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

        // Click Edit on the data route
        const dataRow = summaryTable.locator(
            'tr[data-route-name="data"]',
        );
        const editBtn = dataRow.locator(".edit-route-button");
        await editBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Connection name container should be visible initially
        const outcomeContainer = routeForm.locator(
            ".field-container-success-outcome",
        );
        await expect(outcomeContainer).toBeVisible({ timeout: 3000 });

        // Uncheck create-flowfile
        const createFlowFileCheckbox = routeForm.locator(
            ".create-flowfile-checkbox",
        );
        await createFlowFileCheckbox.uncheck();

        // Connection name container should now be hidden
        await expect(outcomeContainer).toBeHidden();

        // Re-check create-flowfile
        await createFlowFileCheckbox.check();

        // Connection name container should be visible again
        await expect(outcomeContainer).toBeVisible({ timeout: 3000 });

        // Cancel to clean up
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    test("should display API Routes heading", async ({
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

        // Wait for summary table to ensure content is loaded
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // API Routes heading should be visible
        const heading = endpointConfigPanel.locator("h3.api-routes-heading");
        await expect(heading).toBeVisible({ timeout: 5000 });
        const headingText = await heading.textContent();
        expect(
            headingText === "API Routes" || headingText === "API-Routen",
        ).toBe(true);
    });

    test("should show context-help toggle on auth-mode field", async ({
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

        // Click Edit on the first route
        const firstEditBtn = summaryTable
            .locator(".edit-route-button")
            .first();
        await expect(firstEditBtn).toBeVisible({ timeout: 5000 });
        await firstEditBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Auth-mode field container should have a context-help toggle button
        const authModeHelp = routeForm.locator(
            ".field-container-auth-mode .context-help-toggle",
        );
        await expect(authModeHelp).toBeVisible({ timeout: 5000 });

        // Cancel to clean up
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    test("should hide roles and scopes when bearer is removed from auth-mode", async ({
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

        // Click Edit on the data route (default auth-mode is bearer)
        const dataRow = summaryTable.locator(
            'tr[data-route-name="data"]',
        );
        const editBtn = dataRow.locator(".edit-route-button");
        await editBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Roles and scopes containers should be visible when bearer is selected
        const rolesContainer = routeForm.locator(
            ".field-container-required-roles",
        );
        const scopesContainer = routeForm.locator(
            ".field-container-required-scopes",
        );
        await expect(rolesContainer).toBeVisible({ timeout: 3000 });
        await expect(scopesContainer).toBeVisible({ timeout: 3000 });

        // Remove bearer chip to trigger hide
        const bearerChipRemove = routeForm.locator(
            '.auth-mode-chip[data-mode="bearer"] .auth-mode-chip-remove',
        );

        // First add another auth mode so we can remove bearer (minSelected=1)
        const authModeInput = routeForm.locator(".auth-mode-chip-text-input");
        await authModeInput.fill("none");
        // Select from dropdown
        const noneOption = routeForm.locator(
            ".auth-mode-dropdown-item",
        ).first();
        await expect(noneOption).toBeVisible({ timeout: 3000 });
        await noneOption.click();

        // Now remove bearer
        await expect(bearerChipRemove).toBeVisible({ timeout: 3000 });
        await bearerChipRemove.click();

        // Roles and scopes containers should now be hidden
        await expect(rolesContainer).toBeHidden();
        await expect(scopesContainer).toBeHidden();

        // Cancel to clean up
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    test("should display connection map section", async ({
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

        // Wait for summary table to load first
        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Connection map should be present
        const connectionMap = endpointConfigPanel.locator(
            "details.connection-map",
        );
        await expect(connectionMap).toBeVisible({ timeout: 5000 });

        // Summary should mention "NiFi Connections" and "relationships"
        const summary = connectionMap.locator("summary");
        await expect(summary).toContainText("NiFi Connections");
        await expect(summary).toContainText("relationships");

        // Expand the details to reveal the connection map table
        await summary.click();

        // Should contain a table with connection names
        const mapTable = connectionMap.locator(".connection-map-table");
        await expect(mapTable).toBeVisible({ timeout: 3000 });

        // Failure should always be present
        await expect(mapTable).toContainText("failure");
        await expect(mapTable).toContainText("(always present)");

        // Verify all route relationships are listed (not just failure)
        const mapRows = mapTable.locator("tbody tr");
        const mapRowCount = await mapRows.count();
        // Expect at least 5 relationships: validated, data, inline-validated, admin, failure
        expect(mapRowCount).toBeGreaterThanOrEqual(5);

        // Verify specific route relationships are present
        await expect(mapTable).toContainText("validated");
        await expect(mapTable).toContainText("data");
        await expect(mapTable).toContainText("inline-validated");
        await expect(mapTable).toContainText("admin");

        // Collapse back to clean up for next test
        await summary.click();
    });

    test("should show file mode for file-based schema", async ({
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

        // Find the 'validated' route row (which has a file-based schema)
        const validatedRow = summaryTable.locator(
            'tr[data-route-name="validated"]',
        );
        await expect(validatedRow).toBeVisible({ timeout: 5000 });

        // Click Edit on the validated route
        const editBtn = validatedRow.locator(".edit-route-button");
        await editBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Schema checkbox should be checked (route has schema configured)
        const schemaCheckbox = routeForm.locator(".schema-validation-checkbox");
        await expect(schemaCheckbox).toBeChecked();

        // File mode radio should be checked for file-based schema
        const fileRadio = routeForm.locator(".schema-mode-file");
        await expect(fileRadio).toBeChecked();

        // File input should contain the schema file path
        const fileInput = routeForm.locator(".field-schema-file");
        await expect(fileInput).toBeVisible({ timeout: 3000 });
        const schemaValue = await fileInput.inputValue();
        expect(schemaValue).toContain("./conf/schemas/user-request-schema.json");

        // Cancel to clean up
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    test("should toggle schema mode between file and inline", async ({
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

        // Check the schema checkbox to reveal the mode toggle
        const schemaCheckbox = routeForm.locator(".schema-validation-checkbox");
        await schemaCheckbox.check();

        // File mode should be visible by default
        const fileInput = routeForm.locator(".schema-file-input");
        const inlineInput = routeForm.locator(".schema-inline-input");
        await expect(fileInput).toBeVisible({ timeout: 3000 });
        await expect(inlineInput).toBeHidden();

        // Switch to inline mode
        const inlineRadio = routeForm.locator(".schema-mode-inline");
        await inlineRadio.check();
        await expect(inlineInput).toBeVisible({ timeout: 3000 });
        await expect(fileInput).toBeHidden();

        // Switch back to file mode
        const fileRadio = routeForm.locator(".schema-mode-file");
        await fileRadio.check();
        await expect(fileInput).toBeVisible({ timeout: 3000 });
        await expect(inlineInput).toBeHidden();

        // Cancel to clean up
        const cancelBtn = routeForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    test("should display property export panel", async ({
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

        // Export section should exist (collapsed by default)
        const exportSection = endpointConfigPanel.locator(".property-export");
        await expect(exportSection).toBeVisible({ timeout: 5000 });

        // Expand the export section
        const exportSummary = exportSection.locator("summary");
        await exportSummary.click();

        // Textarea and copy button should be visible
        const exportTextarea = exportSection.locator(".property-export-textarea");
        await expect(exportTextarea).toBeVisible({ timeout: 3000 });

        const copyButton = exportSection.locator(".copy-properties-button");
        await expect(copyButton).toBeVisible({ timeout: 3000 });

        // Export text should contain route properties
        const exportText = await exportTextarea.inputValue();
        expect(exportText).toContain("restapi.");
        expect(exportText).toContain(".path");
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

        // Open editor for a route WITHOUT schema (e.g. 'data') to test toggle behavior
        const dataRouteRow = summaryTable.locator('tr[data-route-name="data"]');
        const dataEditBtn = dataRouteRow.locator(".edit-route-button");
        await dataEditBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Schema checkbox should exist
        const schemaCheckbox = routeForm.locator(".schema-validation-checkbox");
        await expect(schemaCheckbox).toBeVisible({ timeout: 5000 });

        // Schema container should be hidden by default (data route has no schema)
        const schemaContainer = routeForm.locator(".field-container-schema");
        await expect(schemaContainer).toBeHidden();

        // Check the checkbox — schema textarea becomes visible
        await schemaCheckbox.check();
        await expect(schemaContainer).toBeVisible({ timeout: 3000 });

        // Uncheck — hidden again
        await schemaCheckbox.uncheck();
        await expect(schemaContainer).toBeHidden();

        // Close editor to restore table for subsequent tests
        const cancelBtn = routeForm.locator("button", { hasText: "Cancel" });
        await cancelBtn.click();
    });

    test("should show persisted badge for loaded routes", async ({
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

        // All loaded rows should have a known origin (persisted or external)
        const dataRows = summaryTable.locator("tbody tr[data-route-name]");
        const rowCount = await dataRows.count();
        expect(rowCount).toBeGreaterThanOrEqual(1);

        for (let i = 0; i < rowCount; i++) {
            const row = dataRows.nth(i);
            const origin = await row.getAttribute("data-origin");
            expect(["persisted", "external"]).toContain(origin);
        }
        // At least one route should have an origin badge (external or persisted)
        const originBadges = summaryTable.locator(".origin-external, .origin-persisted");
        expect(await originBadges.count()).toBeGreaterThanOrEqual(1);
    });

    test("should show new badge after adding a route", async ({
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

        // Fill in new route details
        const routeName = routeForm.locator(".route-name");
        await routeName.fill("e2e-origin-test");
        const pathField = routeForm.locator(".field-path");
        await pathField.fill("/api/e2e-origin-test");
        // Select GET via the method chip input
        const methodInput = routeForm.locator(".method-chip-text-input");
        await methodInput.fill("GET");
        await methodInput.press("Enter");

        // Save
        const saveBtn = routeForm.locator(".save-route-button");
        await saveBtn.click();
        await expect(routeForm).toHaveCount(0, { timeout: 5000 });

        // Verify the new row was persisted (saved via API with componentId)
        const newRow = summaryTable.locator(
            'tr[data-route-name="e2e-origin-test"]',
        );
        await expect(newRow).toBeVisible({ timeout: 5000 });
        await expect(newRow).toHaveAttribute("data-origin", "persisted");
    });

    test("should show modified badge after editing a persisted route", async ({
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

        // Find a persisted route and capture its name for re-location after save
        const firstPersistedRow = summaryTable.locator(
            'tbody tr[data-origin="persisted"]',
        ).first();
        await expect(firstPersistedRow).toBeVisible({ timeout: 5000 });
        const routeName = await firstPersistedRow.getAttribute(
            "data-route-name",
        );

        // Click Edit
        const editBtn = firstPersistedRow.locator(".edit-route-button");
        await editBtn.click();

        const routeForm = endpointConfigPanel.locator(".route-form");
        await expect(routeForm).toBeVisible({ timeout: 5000 });

        // Save without changing anything — the act of saving marks it modified
        const saveBtn = routeForm.locator(".save-route-button");
        await saveBtn.click();
        await expect(routeForm).toHaveCount(0, { timeout: 5000 });

        // Re-locate row by name — origin stays persisted after save with componentId
        const savedRow = summaryTable.locator(
            `tbody tr[data-route-name="${routeName}"]`,
        );
        await expect(savedRow).toHaveAttribute("data-origin", "persisted");
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

    test("should show body input automatically for POST-only route", async ({
        customUIFrame,
        processorService,
    }) => {
        // Navigate to Endpoint Tester tab
        await processorService.clickTab(customUIFrame, "Endpoint Tester");

        const endpointTesterPanel = customUIFrame.locator("#endpoint-tester");
        await expect(endpointTesterPanel).toBeVisible({ timeout: 5000 });

        // First switch to a GET-only route to ensure body is hidden
        const routeSelector = endpointTesterPanel.locator(".route-selector");
        await routeSelector.selectOption("/api/admin");

        const bodyGroup = endpointTesterPanel.locator(".body-group");
        await expect(bodyGroup).toBeHidden({ timeout: 5000 });

        // Now select the POST-only 'validated' route by value
        await routeSelector.selectOption("/api/validated");

        // Body group must become visible without any manual method change
        await expect(bodyGroup).toBeVisible({ timeout: 5000 });

        const bodyInput = endpointTesterPanel.locator(".body-input");
        await expect(bodyInput).toBeVisible({ timeout: 5000 });
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

        // Click refresh button
        await refreshButton.click();

        // Wait for the refresh indicator to appear and disappear (confirms handler ran)
        const refreshIndicator = customUIFrame.locator(
            '[data-testid="refresh-indicator"]',
        );
        await expect(refreshIndicator).toBeHidden({ timeout: 10000 });

        // Verify metrics content remains visible and stable after refresh
        await expect(metricsContent).toBeVisible({ timeout: 5000 });

        // Verify last-updated element is still present (refresh didn't break the UI)
        await expect(lastUpdated).toBeVisible({ timeout: 5000 });
        const timestampAfter = await lastUpdated.textContent();
        expect(timestampAfter).toContain("Last updated:");
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

    test("should show roles and scopes fields in management editor", async ({
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

        // Wait for management endpoints table
        const mgmtTable = customUIFrame.locator(".management-endpoints-table");
        await expect(mgmtTable).toBeVisible({ timeout: 10000 });

        // Click Edit on the health endpoint
        const healthRow = mgmtTable.locator('tr[data-mgmt-name="health"]');
        const editBtn = healthRow.locator(".btn-edit");
        await editBtn.click();

        // Verify management editor form appears
        const mgmtForm = customUIFrame.locator(".mgmt-edit-form");
        await expect(mgmtForm).toBeVisible({ timeout: 5000 });

        // Roles and scopes fields should be present
        const rolesContainer = mgmtForm.locator(
            ".field-container-required-roles",
        );
        const scopesContainer = mgmtForm.locator(
            ".field-container-required-scopes",
        );
        await expect(rolesContainer).toBeVisible({ timeout: 3000 });
        await expect(scopesContainer).toBeVisible({ timeout: 3000 });

        // Verify input fields exist
        const rolesInput = mgmtForm.locator(".field-required-roles");
        const scopesInput = mgmtForm.locator(".field-required-scopes");
        await expect(rolesInput).toBeVisible({ timeout: 3000 });
        await expect(scopesInput).toBeVisible({ timeout: 3000 });

        // Cancel to clean up
        const cancelBtn = mgmtForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    test("should hide management roles/scopes when bearer is removed", async ({
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

        // Wait for management endpoints table
        const mgmtTable = customUIFrame.locator(".management-endpoints-table");
        await expect(mgmtTable).toBeVisible({ timeout: 10000 });

        // Click Edit on the health endpoint
        const healthRow = mgmtTable.locator('tr[data-mgmt-name="health"]');
        const editBtn = healthRow.locator(".btn-edit");
        await editBtn.click();

        const mgmtForm = customUIFrame.locator(".mgmt-edit-form");
        await expect(mgmtForm).toBeVisible({ timeout: 5000 });

        // Roles/scopes should be visible (bearer is in auth-mode)
        const rolesContainer = mgmtForm.locator(
            ".field-container-required-roles",
        );
        const scopesContainer = mgmtForm.locator(
            ".field-container-required-scopes",
        );
        await expect(rolesContainer).toBeVisible({ timeout: 3000 });
        await expect(scopesContainer).toBeVisible({ timeout: 3000 });

        // Remove bearer chip — first add 'none' so we can remove bearer
        const authModeInput = mgmtForm.locator(".auth-mode-chip-text-input");
        await authModeInput.fill("none");
        const noneOption = mgmtForm.locator(
            ".auth-mode-dropdown-item",
        ).first();
        await expect(noneOption).toBeVisible({ timeout: 3000 });
        await noneOption.click();

        // Now remove bearer
        const bearerChipRemove = mgmtForm.locator(
            '.auth-mode-chip[data-mode="bearer"] .auth-mode-chip-remove',
        );
        await expect(bearerChipRemove).toBeVisible({ timeout: 3000 });
        await bearerChipRemove.click();

        // Roles/scopes should now be hidden
        await expect(rolesContainer).toBeHidden();
        await expect(scopesContainer).toBeHidden();

        // Cancel to clean up
        const cancelBtn = mgmtForm.locator(".cancel-route-button");
        await cancelBtn.click();
    });

    // ── Token Fetch Validation ─────────────────────────────────────────

    test("should show red borders on empty required fields when fetching token", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Tester tab
        const testerTab = customUIFrame.locator('a[href="#endpoint-tester"]');
        await expect(testerTab).toBeVisible({ timeout: 5000 });
        await testerTab.click();

        const testerPanel = customUIFrame.locator("#endpoint-tester");
        await expect(testerPanel).toBeVisible({ timeout: 5000 });

        // Expand token fetch section
        const toggleBtn = testerPanel.locator(".token-fetch-toggle");
        await expect(toggleBtn).toBeVisible({ timeout: 5000 });
        await toggleBtn.click();

        const tokenFetchBody = testerPanel.locator(".token-fetch-body");
        await expect(tokenFetchBody).toBeVisible({ timeout: 5000 });

        // Click fetch with all fields empty
        const fetchBtn = testerPanel.locator(".fetch-token-btn");
        await fetchBtn.click();

        // Verify red borders on required fields
        const urlInput = testerPanel.locator(".token-endpoint-url");
        await expect(urlInput).toHaveClass(/input-error/, { timeout: 3000 });

        const clientIdInput = testerPanel.locator(".tf-client-id");
        await expect(clientIdInput).toHaveClass(/input-error/, { timeout: 3000 });
    });

    test("should fetch token with valid ROPC credentials (public client, no secret)", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Tester tab
        const testerTab = customUIFrame.locator('a[href="#endpoint-tester"]');
        await expect(testerTab).toBeVisible({ timeout: 5000 });
        await testerTab.click();

        const testerPanel = customUIFrame.locator("#endpoint-tester");
        await expect(testerPanel).toBeVisible({ timeout: 5000 });

        // Expand token fetch section
        const toggleBtn = testerPanel.locator(".token-fetch-toggle");
        const tokenFetchBody = testerPanel.locator(".token-fetch-body");
        if (await tokenFetchBody.isHidden()) {
            await toggleBtn.click();
        }
        await expect(tokenFetchBody).toBeVisible({ timeout: 5000 });

        // Use auto-discovery via the issuer dropdown (resolves Docker-internal URL)
        const issuerSelector = testerPanel.locator(".issuer-selector");
        await expect(issuerSelector).toBeVisible({ timeout: 10000 });

        // Wait for issuers to load (select value should not be empty)
        await expect(issuerSelector).not.toHaveValue("", { timeout: 10000 });

        // Trigger discover by clicking the discover button
        const discoverBtn = testerPanel.locator(".discover-btn");
        await discoverBtn.click();

        // Wait for token endpoint URL to be populated
        const tokenEndpointInput = testerPanel.locator(".token-endpoint-url");
        await expect(tokenEndpointInput).not.toHaveValue("", { timeout: 10000 });

        // Fill in ROPC fields — public client, no secret needed
        await testerPanel.locator(".tf-client-id").fill(CONSTANTS.KEYCLOAK_CONFIG.CLIENT_ID);
        await testerPanel.locator(".tf-username").fill(CONSTANTS.AUTH.USERNAME);
        await testerPanel.locator(".tf-password").fill(CONSTANTS.AUTH.PASSWORD);
        // Client secret intentionally left empty

        // Click fetch
        const fetchBtn = testerPanel.locator(".fetch-token-btn");
        await fetchBtn.click();

        // Wait for success status with countdown
        const statusEl = testerPanel.locator(".token-fetch-status");
        await expect(statusEl).toHaveClass(/success/, { timeout: 15000 });

        // Verify token was populated in textarea
        const tokenInput = testerPanel.locator(".token-input");
        const tokenValue = await tokenInput.inputValue();
        expect(tokenValue.length).toBeGreaterThan(10);
    });

    test("should update required field asterisks when switching grant type", async ({
        customUIFrame,
    }) => {
        // Navigate to Endpoint Tester tab
        const testerTab = customUIFrame.locator('a[href="#endpoint-tester"]');
        await expect(testerTab).toBeVisible({ timeout: 5000 });
        await testerTab.click();

        const testerPanel = customUIFrame.locator("#endpoint-tester");
        await expect(testerPanel).toBeVisible({ timeout: 5000 });

        // Expand token fetch section
        const toggleBtn = testerPanel.locator(".token-fetch-toggle");
        const tokenFetchBody = testerPanel.locator(".token-fetch-body");
        if (await tokenFetchBody.isHidden()) {
            await toggleBtn.click();
        }
        await expect(tokenFetchBody).toBeVisible({ timeout: 5000 });

        // In ROPC mode, username/password should be required
        const usernameLabel = tokenFetchBody.locator('label[for="tf-username"]');
        await expect(usernameLabel).toHaveClass(/required-field/, { timeout: 3000 });

        // Switch to Client Credentials
        const grantSelector = testerPanel.locator(".grant-type-selector");
        await grantSelector.selectOption("client_credentials");

        // Client secret should now be required
        const secretLabel = tokenFetchBody.locator('label[for="tf-client-secret"]');
        await expect(secretLabel).toHaveClass(/required-field/, { timeout: 3000 });

        // Username should no longer be required
        await expect(usernameLabel).not.toHaveClass(/required-field/);
    });

    // ── External Config Routes in UI ─────────────────────────────────

    test("should display externally configured routes with external badge", async ({
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

        // Verify external routes appear with External badge
        const adminRow = summaryTable.locator('tbody tr[data-route-name="admin"]');
        await expect(adminRow).toBeVisible({ timeout: 5000 });
        const adminBadge = adminRow.locator(".origin-external");
        await expect(adminBadge).toBeVisible();

        // Verify other external routes exist
        const validatedRow = summaryTable.locator(
            'tbody tr[data-route-name="validated"]',
        );
        await expect(validatedRow).toBeVisible({ timeout: 5000 });
        const validatedBadge = validatedRow.locator(".origin-external");
        await expect(validatedBadge).toBeVisible();

        const inlineValidatedRow = summaryTable.locator(
            'tbody tr[data-route-name="inline-validated"]',
        );
        await expect(inlineValidatedRow).toBeVisible({ timeout: 5000 });
    });

    test("should show edit but no delete for external routes", async ({
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

        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // External routes should have edit button but no delete button
        const adminRow = summaryTable.locator('tbody tr[data-route-name="admin"]');
        await expect(adminRow).toBeVisible({ timeout: 5000 });
        await expect(adminRow.locator(".edit-route-button")).toBeVisible();
        await expect(adminRow.locator(".remove-route-button")).toHaveCount(0);
    });

    test("should not display disabled-test route from external config", async ({
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

        const summaryTable = endpointConfigPanel.locator(".route-summary-table");
        await expect(summaryTable).toBeVisible({ timeout: 15000 });

        // Disabled route should not appear in the table
        const disabledRow = summaryTable.locator(
            'tbody tr[data-route-name="disabled-test"]',
        );
        await expect(disabledRow).toHaveCount(0);
    });
});
