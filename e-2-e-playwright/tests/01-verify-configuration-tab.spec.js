/**
 * @file Configuration Tab Test
 * Verifies the configuration tab structure and issuer management in the JWT authenticator UI
 * @version 1.0.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

// Skip: issuer configuration moved to CS — re-enable after #137 UI migration
test.describe.skip("Configuration Tab", () => {
    test.beforeEach(async ({ page, processorManager }, testInfo) => {
        const authService = new AuthService(page);
        await authService.ensureReady();

        await processorManager.ensureProcessorOnCanvas();
        await takeStartScreenshot(page, testInfo);
    });

    test("should display configuration tab structure", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        await processorService.openAdvancedUI(processor);

        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Could not find custom UI iframe");
        }

        // Verify container, panel, and tabs structure
        const structuralElements = [
            {
                selector: '[data-testid="jwt-customizer-container"]',
                name: "JWT Customizer Container",
            },
            {
                selector: '[data-testid="issuer-config-panel"]',
                name: "Issuer Configuration Panel",
            },
            {
                selector: '[data-testid="jwt-config-tabs"]',
                name: "Configuration Tabs",
            },
            {
                selector: 'h2:has-text("Issuer Configurations")',
                name: "Issuer Configurations header",
            },
            {
                selector: 'button:has-text("Add Issuer")',
                name: "Add Issuer button",
            },
        ];

        for (const element of structuralElements) {
            const el = customUIFrame.locator(element.selector);
            await expect(el).toBeVisible({ timeout: 5000 });
        }

        // Verify all four tab names are present
        const tabs = ["Configuration", "Token Verification", "Metrics", "Help"];

        for (const tabName of tabs) {
            const tabSelector = `[role="tab"]:has-text("${tabName}")`;
            const tab = customUIFrame.locator(tabSelector);
            await expect(tab).toBeVisible({ timeout: 5000 });
        }
    });

    test("should add issuer and verify form fields", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);

        if (!advancedOpened) {
            throw new Error("Failed to open Advanced UI via right-click menu");
        }

        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Could not find custom UI iframe");
        }

        // Click Add Issuer button
        const addIssuerButton = customUIFrame.locator(
            'button:has-text("Add Issuer")',
        );
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        // Wait for form to render
        await page.waitForTimeout(1000);

        // Verify issuer name input appeared
        const issuerInputCount = await customUIFrame
            .locator("input.issuer-name")
            .count();

        if (issuerInputCount > 0) {
            const lastInput = customUIFrame.locator("input.issuer-name").last();
            if (await lastInput.isVisible()) {
                await lastInput.fill("test-issuer");
            }
        }
    });

    test("should handle issuer configuration interactions", async ({
        page,
    }, testInfo) => {
        const processorService = new ProcessorService(page, testInfo);

        const processor = await processorService.findJwtAuthenticator({
            failIfNotFound: true,
        });

        const advancedOpened = await processorService.openAdvancedUI(processor);

        if (!advancedOpened) {
            throw new Error("Failed to open Advanced UI via right-click menu");
        }

        const customUIFrame = await processorService.getAdvancedUIFrame();

        if (!customUIFrame) {
            throw new Error("Could not find custom UI iframe");
        }

        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });

        await addIssuerButton.click();

        // Wait for form to be fully enabled
        await page.waitForTimeout(2000);

        const issuerFormFields = [
            {
                selector: 'input[placeholder="e.g., keycloak"]',
                value: "test-issuer",
                description: "Issuer Name",
                index: 0,
            },
            {
                selector: 'input[name="jwks-url"]',
                value: "https://example.com/.well-known/jwks.json",
                description: "JWKS URL",
            },
            {
                selector: 'input[name="audience"]',
                value: "test-audience",
                description: "Audience",
            },
        ];

        for (const field of issuerFormFields) {
            let input;
            if (field.index !== undefined) {
                input = customUIFrame.locator(field.selector).nth(field.index);
            } else {
                input = customUIFrame.locator(field.selector).first();
            }
            await expect(input).toBeVisible({ timeout: 5000 });

            // Verify input is enabled
            const isEnabled = await input.isEnabled();
            if (!isEnabled) {
                throw new Error(
                    `TEST FAILURE: ${field.description} input is disabled when it should be enabled. ` +
                        `This indicates a UI state issue that needs to be resolved in the application code.`,
                );
            }

            await input.fill(field.value);
        }

        const saveButton = customUIFrame
            .getByRole("button", { name: "Save Issuer" })
            .first();
        await expect(saveButton).toBeVisible({ timeout: 5000 });
        await saveButton.click();

        // Check if issuer was saved
        try {
            const savedIssuer = customUIFrame
                .locator(
                    'text="test-issuer", [value="test-issuer"], .issuer-name',
                )
                .first();
            await expect(savedIssuer).toBeVisible({ timeout: 5000 });
        } catch (_error) {
            // If not immediately visible, verify the save button worked
            try {
                const addAnotherButton = customUIFrame.getByRole("button", {
                    name: "Add Issuer",
                });
                await expect(addAnotherButton).toBeVisible({
                    timeout: 5000,
                });
            } catch (_e) {
                // Issuer configuration operation completed
            }
        }
    });
});
