/**
 * @file Configuration Tab Test
 * Verifies the configuration tab structure and issuer management in the JWT authenticator UI
 */

import {
    serialTest as test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";

test.describe("Configuration Tab", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should display configuration tab structure", async ({
        customUIFrame,
    }) => {
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
        customUIFrame,
    }) => {
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

        // Verify save success message is displayed (displayUiSuccess renders .success-message)
        const successMessage = customUIFrame
            .locator(".success-message")
            .first();
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        await expect(successMessage).toContainText("saved successfully");

        // Verify issuer was saved — the issuer name must appear in an input field value
        // (The UI keeps issuers in editable form, not as collapsed text)
        const issuerNameInput = customUIFrame
            .locator('input.issuer-name[value="test-issuer"], input[placeholder="e.g., keycloak"]')
            .first();
        await expect(issuerNameInput).toHaveValue("test-issuer", {
            timeout: 5000,
        });
    });

    test("should delete an existing issuer", async ({ customUIFrame }) => {
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

    test("should edit an existing issuer configuration", async ({
        customUIFrame,
    }) => {
        // Add an issuer first
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        const issuerForms = customUIFrame.locator(".issuer-form");
        const existingCount = await issuerForms.count();

        await addIssuerButton.click();

        // Target the newly added form
        const newForm = issuerForms.nth(existingCount);

        const issuerNameInput = newForm.locator(
            'input[placeholder="e.g., keycloak"]',
        );
        await issuerNameInput.fill("edit-test-issuer");

        const issuerUriInput = newForm.locator('input[name="issuer"]');
        await issuerUriInput.fill("https://original-issuer.example.com");

        const jwksUrlInput = newForm.locator('input[name="jwks-url"]');
        await jwksUrlInput.fill(
            "https://original.example.com/.well-known/jwks.json",
        );

        const audienceInput = newForm.locator('input[name="audience"]');
        await audienceInput.fill("original-audience");

        // Save the initial issuer
        const saveButton = newForm.getByRole("button", {
            name: "Save Issuer",
        });
        await saveButton.click();

        const successMessage = newForm.locator(".success-message").first();
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        await expect(successMessage).toContainText("saved successfully");

        // Edit the issuer: change audience and JWKS URL
        await audienceInput.fill("updated-audience");
        await jwksUrlInput.fill(
            "https://updated.example.com/.well-known/jwks.json",
        );

        // Save again
        await saveButton.click();

        // Verify save success
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        await expect(successMessage).toContainText("saved successfully");

        // Verify updated values are preserved in the form
        await expect(audienceInput).toHaveValue("updated-audience");
        await expect(jwksUrlInput).toHaveValue(
            "https://updated.example.com/.well-known/jwks.json",
        );

        // Clean up: remove the test issuer
        await newForm.getByRole("button", { name: "Remove" }).click();

        const confirmButton = customUIFrame
            .locator(
                '.confirmation-dialog .confirm-button, button:has-text("Confirm"), button:has-text("Yes")',
            )
            .first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
        }
    });

    test("should manage multiple issuers simultaneously", async ({
        customUIFrame,
    }) => {
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        const issuerForms = customUIFrame.locator(".issuer-form");

        // Count existing forms before adding
        const existingCount = await issuerForms.count();

        // Add first issuer — new form appears at the end
        await addIssuerButton.click();
        const firstForm = issuerForms.nth(existingCount);

        await firstForm
            .locator('input[placeholder="e.g., keycloak"]')
            .fill("issuer-one");
        await firstForm
            .locator('input[name="issuer"]')
            .fill("https://issuer-one.example.com");
        await firstForm
            .locator('input[name="jwks-url"]')
            .fill("https://issuer-one.example.com/.well-known/jwks.json");

        await firstForm.getByRole("button", { name: "Save Issuer" }).click();

        // Verify first issuer saved
        const firstSuccess = firstForm.locator(".success-message");
        await expect(firstSuccess).toBeVisible({ timeout: 10000 });

        // Add second issuer — new form appears at the end
        await addIssuerButton.click();
        const secondForm = issuerForms.nth(existingCount + 1);

        await secondForm
            .locator('input[placeholder="e.g., keycloak"]')
            .fill("issuer-two");
        await secondForm
            .locator('input[name="issuer"]')
            .fill("https://issuer-two.example.com");
        await secondForm
            .locator('input[name="jwks-url"]')
            .fill("https://issuer-two.example.com/.well-known/jwks.json");

        await secondForm.getByRole("button", { name: "Save Issuer" }).click();

        // Verify second issuer saved
        const secondSuccess = secondForm.locator(".success-message");
        await expect(secondSuccess).toBeVisible({ timeout: 10000 });

        // Verify both issuer names are visible
        const allNameInputs = customUIFrame.locator(
            'input[placeholder="e.g., keycloak"]',
        );
        const names = [];
        const nameCount = await allNameInputs.count();
        for (let i = 0; i < nameCount; i++) {
            names.push(await allNameInputs.nth(i).inputValue());
        }
        expect(names).toContain("issuer-one");
        expect(names).toContain("issuer-two");

        // Remove first added issuer (issuer-one) via its own Remove button
        await firstForm.getByRole("button", { name: "Remove" }).click();

        const confirmButton = customUIFrame
            .locator(
                '.confirmation-dialog .confirm-button, button:has-text("Confirm"), button:has-text("Yes")',
            )
            .first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
        }

        // Verify only issuer-two remains among the added issuers
        const remainingInputs = customUIFrame.locator(
            'input[placeholder="e.g., keycloak"]',
        );
        const remainingNames = [];
        const remainingCount = await remainingInputs.count();
        for (let i = 0; i < remainingCount; i++) {
            remainingNames.push(await remainingInputs.nth(i).inputValue());
        }
        expect(remainingNames).not.toContain("issuer-one");
        expect(remainingNames).toContain("issuer-two");

        // Clean up: remove issuer-two — it's now the last form
        const lastForm = issuerForms.last();
        await lastForm.getByRole("button", { name: "Remove" }).click();

        if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
        }
    });

    test("should save issuer with inline JWKS content", async ({
        customUIFrame,
    }) => {
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        const issuerForms = customUIFrame.locator(".issuer-form");
        const existingCount = await issuerForms.count();

        await addIssuerButton.click();

        // Target the newly added form
        const newForm = issuerForms.nth(existingCount);

        // Fill issuer name and URI
        const issuerNameInput = newForm.locator(
            'input[placeholder="e.g., keycloak"]',
        );
        await issuerNameInput.fill("memory-issuer");

        const issuerUriInput = newForm.locator('input[name="issuer"]');
        await issuerUriInput.fill("https://memory-issuer.example.com");

        // Switch JWKS Source Type to "Memory"
        const jwksTypeSelect = newForm.locator('select[name="jwks-type"]');
        await jwksTypeSelect.selectOption("memory");

        // Fill textarea with valid JWKS JSON
        const jwksContentArea = newForm.locator(
            'textarea[name="jwks-content"]',
        );
        await expect(jwksContentArea).toBeVisible({ timeout: 5000 });

        const validJwks = JSON.stringify({
            keys: [
                {
                    kty: "RSA",
                    kid: "test-key-1",
                    use: "sig",
                    alg: "RS256",
                    n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
                    e: "AQAB",
                },
            ],
        });
        await jwksContentArea.fill(validJwks);

        // Save the issuer
        const saveButton = newForm.getByRole("button", {
            name: "Save Issuer",
        });
        await saveButton.click();

        // Verify save success
        const successMessage = newForm.locator(".success-message").first();
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        await expect(successMessage).toContainText("saved successfully");

        // Verify JWKS type still shows "Memory"
        await expect(jwksTypeSelect).toHaveValue("memory");

        // Verify issuer name is preserved
        await expect(issuerNameInput).toHaveValue("memory-issuer");

        // Clean up: remove the test issuer
        await newForm.getByRole("button", { name: "Remove" }).click();

        const confirmButton = customUIFrame
            .locator(
                '.confirmation-dialog .confirm-button, button:has-text("Confirm"), button:has-text("Yes")',
            )
            .first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
        }
    });

    test("should handle duplicate issuer names", async ({
        customUIFrame,
    }) => {
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        const issuerForms = customUIFrame.locator(".issuer-form");
        const existingCount = await issuerForms.count();

        // Add first issuer with name "duplicate-name"
        await addIssuerButton.click();
        const firstForm = issuerForms.nth(existingCount);

        await firstForm
            .locator('input[placeholder="e.g., keycloak"]')
            .fill("duplicate-name");
        await firstForm
            .locator('input[name="jwks-url"]')
            .fill("https://first.example.com/.well-known/jwks.json");

        await firstForm.getByRole("button", { name: "Save Issuer" }).click();

        const firstSuccess = firstForm.locator(".success-message");
        await expect(firstSuccess).toBeVisible({ timeout: 10000 });

        // Add second issuer with the same name "duplicate-name"
        await addIssuerButton.click();
        const secondForm = issuerForms.nth(existingCount + 1);

        await secondForm
            .locator('input[placeholder="e.g., keycloak"]')
            .fill("duplicate-name");
        await secondForm
            .locator('input[name="jwks-url"]')
            .fill("https://second.example.com/.well-known/jwks.json");

        await secondForm.getByRole("button", { name: "Save Issuer" }).click();

        // The UI should either prevent the duplicate or show an error/warning.
        // Check for error message first; if none, verify behavior is at least predictable.
        const errorMessage = secondForm.locator(".error-message").first();
        const successMessage = secondForm.locator(".success-message").first();

        // Wait for either an error or success response
        await expect(
            secondForm.locator(".error-message, .success-message").first(),
        ).toBeVisible({ timeout: 10000 });

        const hasError = await errorMessage.isVisible().catch(() => false);
        const hasSuccess = await successMessage.isVisible().catch(() => false);

        // Either the UI prevents the duplicate (error) or allows it (success).
        // Both are acceptable — the key assertion is that the UI responds gracefully
        // (no crash, no blank screen, no unhandled exception).
        expect(hasError || hasSuccess).toBe(true);

        if (hasError) {
            const errorText = await errorMessage.textContent();
            expect(errorText).toMatch(/duplicate|already exists|unique/i);
        }

        // Clean up: remove added issuers in reverse order
        const cleanupForms = [secondForm, firstForm];
        const confirmButton = customUIFrame
            .locator(
                '.confirmation-dialog .confirm-button, button:has-text("Confirm"), button:has-text("Yes")',
            )
            .first();

        for (const form of cleanupForms) {
            const removeBtn = form.getByRole("button", { name: "Remove" });
            if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await removeBtn.click();
                if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmButton.click();
                }
            }
        }
    });

    test("should show error when saving issuer with missing required fields", async ({
        customUIFrame,
    }) => {
        const addIssuerButton = customUIFrame.getByRole("button", {
            name: "Add Issuer",
        });
        const issuerForms = customUIFrame.locator(".issuer-form");
        const existingCount = await issuerForms.count();

        await addIssuerButton.click();

        // Target the newly added form (last one)
        const newForm = issuerForms.nth(existingCount);

        // The new form comes pre-populated with sample values.
        // Clear Issuer URI and JWKS URL to trigger "required" validation.
        const issuerNameInput = newForm.locator(
            'input[placeholder="e.g., keycloak"]',
        );
        await issuerNameInput.fill("incomplete-issuer");

        const issuerUriInput = newForm.locator('input[name="issuer"]');
        await issuerUriInput.fill("");

        const jwksUrlInput = newForm.locator('input[name="jwks-url"]');
        await jwksUrlInput.fill("");

        // Click save with missing required fields
        const saveButton = newForm.getByRole("button", { name: "Save Issuer" });
        await saveButton.click();

        // Verify error message about required fields is displayed
        const errorMessage = newForm.locator(".error-message").first();
        await expect(errorMessage).toBeVisible({ timeout: 10000 });

        const errorText = await errorMessage.textContent();
        expect(errorText).toMatch(/required/i);

        // Clean up: remove the incomplete issuer form
        await newForm.getByRole("button", { name: "Remove" }).click();

        const confirmButton = customUIFrame
            .locator(
                '.confirmation-dialog .confirm-button, button:has-text("Confirm"), button:has-text("Yes")',
            )
            .first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
        }
    });
});
