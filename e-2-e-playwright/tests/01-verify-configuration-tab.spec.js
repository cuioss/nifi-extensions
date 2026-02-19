/**
 * @file Configuration Tab Test
 * Verifies the configuration tab structure and issuer management in the JWT authenticator UI
 * @version 1.2.0
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { AuthService } from "../utils/auth-service.js";
import { ProcessorService } from "../utils/processor.js";

test.describe("Configuration Tab", () => {
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

        // Verify all four tabs with href links and click navigation
        const expectedTabs = [
            { name: "Configuration", href: "#issuer-config" },
            { name: "Token Verification", href: "#token-verification" },
            { name: "Metrics", href: "#metrics" },
            { name: "Help", href: "#help" },
        ];

        for (const tab of expectedTabs) {
            const tabElement = customUIFrame.getByRole("tab", {
                name: tab.name,
                exact: true,
            });
            await expect(tabElement).toBeVisible({ timeout: 5000 });

            // Verify tab href link exists
            const tabLink = customUIFrame.locator(`a[href="${tab.href}"]`);
            await expect(tabLink).toBeVisible({ timeout: 5000 });
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
            await expect(input).toBeEnabled({ timeout: 5000 });

            await input.fill(field.value);
        }

        const saveButton = customUIFrame
            .getByRole("button", { name: "Save Issuer" })
            .first();
        await expect(saveButton).toBeVisible({ timeout: 5000 });
        await saveButton.click();

        // Verify issuer was saved — the issuer name must appear in an input field value
        // (The UI keeps issuers in editable form, not as collapsed text)
        const issuerNameInput = customUIFrame
            .locator('input.issuer-name[value="test-issuer"], input[placeholder="e.g., keycloak"]')
            .first();
        await expect(issuerNameInput).toHaveValue("test-issuer", {
            timeout: 5000,
        });
    });

    test("should delete an existing issuer", async ({ page }, testInfo) => {
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

        // First, add an issuer to delete
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        await expect(addIssuerButton).toBeVisible({ timeout: 5000 });
        await addIssuerButton.click();

        const issuerNameInput = customUIFrame
            .locator('input[placeholder="e.g., keycloak"]')
            .first();
        await expect(issuerNameInput).toBeVisible({ timeout: 5000 });
        await issuerNameInput.fill("delete-me-issuer");

        const jwksUrlInput = customUIFrame
            .locator('input[name="jwks-url"]')
            .first();
        await expect(jwksUrlInput).toBeVisible({ timeout: 5000 });
        await jwksUrlInput.fill("https://example.com/.well-known/jwks.json");

        const saveButton = customUIFrame
            .getByRole("button", { name: "Save Issuer" })
            .first();
        await expect(saveButton).toBeVisible({ timeout: 5000 });
        await saveButton.click();

        // Verify issuer was saved (name appears in input field)
        await expect(issuerNameInput).toHaveValue("delete-me-issuer", {
            timeout: 5000,
        });

        // Find and click the Remove button for this issuer
        // The Remove button is adjacent to the issuer name input in the same form section
        const removeButton = customUIFrame
            .getByRole("button", { name: "Remove" })
            .first();
        await expect(removeButton).toBeVisible({ timeout: 5000 });
        await removeButton.click();

        // Handle confirmation dialog if it appears
        const confirmButton = customUIFrame
            .locator(
                '.confirmation-dialog .confirm-button, button:has-text("Confirm"), button:has-text("Yes")',
            )
            .first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
        }

        // Verify the issuer name "delete-me-issuer" is no longer in any input field
        const remainingInputs = customUIFrame.locator(
            'input[placeholder="e.g., keycloak"]',
        );
        const count = await remainingInputs.count();
        for (let i = 0; i < count; i++) {
            const value = await remainingInputs.nth(i).inputValue();
            expect(value).not.toBe("delete-me-issuer");
        }
    });
});
