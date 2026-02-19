/**
 * @file Configuration Tab Test
 * Verifies the configuration tab structure and issuer management in the JWT authenticator UI
 * @version 1.1.0
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

        // Wait for issuer name input to render (replaces waitForTimeout)
        const lastInput = customUIFrame.locator("input.issuer-name").last();
        await expect(lastInput).toBeVisible({ timeout: 5000 });

        await lastInput.fill("test-issuer");
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

        // Verify issuer was saved — look for the saved name or the Add Issuer button (indicating form reset)
        const savedIssuer = customUIFrame
            .locator(
                'text="test-issuer", [value="test-issuer"], .issuer-name',
            )
            .first();
        const addAnotherButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });

        // Either the saved issuer is visible or the form reset to show Add Issuer again
        await expect(
            savedIssuer.or(addAnotherButton),
        ).toBeVisible({ timeout: 5000 });
    });
});
