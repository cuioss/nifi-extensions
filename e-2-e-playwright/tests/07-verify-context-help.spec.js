/**
 * @file Context Help Verification
 * Verifies that the context-help disclosure widgets are present and functional
 * on global settings, route editor fields, and issuer config fields.
 * Includes keyboard interaction, ARIA compliance, and WCAG checks.
 */

import {
    serialGatewayTest as gatewayTest,
    serialTest as jwtTest,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import AxeBuilder from "@axe-core/playwright";

// ---------------------------------------------------------------------------
// Gateway context (Endpoint Configuration tab)
// ---------------------------------------------------------------------------

gatewayTest.describe("Context Help — Gateway", () => {
    gatewayTest.describe.configure({ mode: "serial" });

    gatewayTest.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    gatewayTest(
        "should display context help buttons on global settings",
        async ({ customUIFrame }) => {
            // Navigate to Endpoint Configuration tab
            const tab = customUIFrame.locator('a[href="#endpoint-config"]');
            await expect(tab).toBeVisible({ timeout: 5000 });
            await tab.click();

            const panel = customUIFrame.locator("#endpoint-config");
            await expect(panel).toBeVisible({ timeout: 5000 });

            // Wait for global settings to load
            const settingsTable = panel.locator(
                ".global-settings-display .config-table",
            );
            await expect(settingsTable).toBeVisible({ timeout: 15000 });

            // Context help buttons should be present
            const helpButtons = settingsTable.locator(".context-help-toggle");
            const count = await helpButtons.count();
            expect(count).toBeGreaterThanOrEqual(1);
        },
    );

    gatewayTest(
        "should toggle context help panel on click",
        async ({ customUIFrame }) => {
            const tab = customUIFrame.locator('a[href="#endpoint-config"]');
            await expect(tab).toBeVisible({ timeout: 5000 });
            await tab.click();

            const panel = customUIFrame.locator("#endpoint-config");
            await expect(panel).toBeVisible({ timeout: 5000 });

            const settingsTable = panel.locator(
                ".global-settings-display .config-table",
            );
            await expect(settingsTable).toBeVisible({ timeout: 15000 });

            // Find first help button
            const firstButton = settingsTable
                .locator(".context-help-toggle")
                .first();
            await expect(firstButton).toBeVisible({ timeout: 5000 });

            // Should start collapsed
            await expect(firstButton).toHaveAttribute(
                "aria-expanded",
                "false",
            );

            // Click to expand
            await firstButton.click();
            await expect(firstButton).toHaveAttribute(
                "aria-expanded",
                "true",
            );

            // Panel should be visible and contain property key in <code>
            const controlsId = await firstButton.getAttribute("aria-controls");
            const helpPanel = customUIFrame.locator(`#${controlsId}`);
            await expect(helpPanel).toBeVisible({ timeout: 3000 });
            const code = helpPanel.locator("code");
            await expect(code).toBeVisible();
            const codeText = await code.textContent();
            expect(codeText).toMatch(/^rest\.gateway\./);

            // Click again to collapse
            await firstButton.click();
            await expect(firstButton).toHaveAttribute(
                "aria-expanded",
                "false",
            );
            await expect(helpPanel).toBeHidden();
        },
    );

    gatewayTest(
        "should support keyboard interaction (Enter and Escape)",
        async ({ customUIFrame }) => {
            const tab = customUIFrame.locator('a[href="#endpoint-config"]');
            await expect(tab).toBeVisible({ timeout: 5000 });
            await tab.click();

            const panel = customUIFrame.locator("#endpoint-config");
            await expect(panel).toBeVisible({ timeout: 5000 });

            const settingsTable = panel.locator(
                ".global-settings-display .config-table",
            );
            await expect(settingsTable).toBeVisible({ timeout: 15000 });

            const firstButton = settingsTable
                .locator(".context-help-toggle")
                .first();
            await expect(firstButton).toBeVisible({ timeout: 5000 });

            // Focus the button and press Enter to open
            await firstButton.focus();
            await firstButton.press("Enter");
            await expect(firstButton).toHaveAttribute(
                "aria-expanded",
                "true",
            );

            // Press Escape to close
            await firstButton.press("Escape");
            await expect(firstButton).toHaveAttribute(
                "aria-expanded",
                "false",
            );
        },
    );

    gatewayTest(
        "should display context help in route editor fields",
        async ({ customUIFrame }) => {
            const tab = customUIFrame.locator('a[href="#endpoint-config"]');
            await expect(tab).toBeVisible({ timeout: 5000 });
            await tab.click();

            const panel = customUIFrame.locator("#endpoint-config");
            await expect(panel).toBeVisible({ timeout: 5000 });

            // Wait for table and click edit on first route
            const summaryTable = panel.locator(".route-summary-table");
            await expect(summaryTable).toBeVisible({ timeout: 15000 });

            const editBtn = summaryTable
                .locator(".edit-route-button")
                .first();
            await expect(editBtn).toBeVisible({ timeout: 5000 });
            await editBtn.click();

            // Route form should appear with context help buttons
            const routeForm = panel.locator(".route-form");
            await expect(routeForm).toBeVisible({ timeout: 5000 });

            const helpButtons = routeForm.locator(".context-help-toggle");
            const count = await helpButtons.count();
            // At least name, path, create-flowfile, connection, schema, enabled
            expect(count).toBeGreaterThanOrEqual(4);

            // Clean up: cancel the edit
            const cancelBtn = routeForm.locator(".cancel-route-button");
            await cancelBtn.click();
        },
    );

    gatewayTest(
        "should pass WCAG checks with context help present",
        async ({ page, customUIFrame }) => {
            const tab = customUIFrame.locator('a[href="#endpoint-config"]');
            await expect(tab).toBeVisible({ timeout: 5000 });
            await tab.click();

            const panel = customUIFrame.locator("#endpoint-config");
            await expect(panel).toBeVisible({ timeout: 5000 });

            const settingsTable = panel.locator(
                ".global-settings-display .config-table",
            );
            await expect(settingsTable).toBeVisible({ timeout: 15000 });

            // Open one context help panel so it's visible during the scan
            const firstButton = settingsTable
                .locator(".context-help-toggle")
                .first();
            await expect(firstButton).toBeVisible({ timeout: 5000 });
            await firstButton.click();
            await expect(firstButton).toHaveAttribute(
                "aria-expanded",
                "true",
            );

            // Run axe-core on the page
            const results = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa"])
                .analyze();

            // Filter out known NiFi-platform violations (not from our code)
            const ownViolations = results.violations.filter(
                (v) =>
                    !v.id.includes("color-contrast") &&
                    !v.id.includes("frame-title"),
            );
            expect(ownViolations).toEqual([]);
        },
    );
});

// ---------------------------------------------------------------------------
// JWT Issuer Configuration context
// ---------------------------------------------------------------------------

jwtTest.describe("Context Help — Issuer Config", () => {
    jwtTest.describe.configure({ mode: "serial" });

    jwtTest.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    jwtTest(
        "should display context help buttons on issuer config form",
        async ({ customUIFrame }) => {
            // Navigate to Configuration tab (issuer config)
            const configTab = customUIFrame.locator(
                'a[href="#issuer-config"]',
            );
            await expect(configTab).toBeVisible({ timeout: 5000 });
            await configTab.click();

            const configPanel = customUIFrame.locator("#issuer-config");
            await expect(configPanel).toBeVisible({ timeout: 5000 });

            // Wait for issuer form to appear
            const issuerForm = configPanel.locator(".issuer-form");
            await expect(issuerForm.first()).toBeVisible({ timeout: 15000 });

            // Context help buttons should be present
            const helpButtons = issuerForm
                .first()
                .locator(".context-help-toggle");
            const count = await helpButtons.count();
            // At least name, jwks-type, issuer-uri, jwks-url, audience, client-id
            expect(count).toBeGreaterThanOrEqual(4);
        },
    );

    jwtTest(
        "should show correct issuer property key in help panel",
        async ({ customUIFrame }) => {
            const configTab = customUIFrame.locator(
                'a[href="#issuer-config"]',
            );
            await expect(configTab).toBeVisible({ timeout: 5000 });
            await configTab.click();

            const configPanel = customUIFrame.locator("#issuer-config");
            await expect(configPanel).toBeVisible({ timeout: 5000 });

            const issuerForm = configPanel.locator(".issuer-form");
            await expect(issuerForm.first()).toBeVisible({ timeout: 15000 });

            // Click first help button
            const firstButton = issuerForm
                .first()
                .locator(".context-help-toggle")
                .first();
            await expect(firstButton).toBeVisible({ timeout: 5000 });
            await firstButton.click();

            // Panel should show an issuer property key
            const controlsId =
                await firstButton.getAttribute("aria-controls");
            const helpPanel = customUIFrame.locator(`#${controlsId}`);
            await expect(helpPanel).toBeVisible({ timeout: 3000 });

            const code = helpPanel.locator("code");
            await expect(code).toBeVisible();
            const codeText = await code.textContent();
            expect(codeText).toMatch(/^issuer\./);
        },
    );
});
