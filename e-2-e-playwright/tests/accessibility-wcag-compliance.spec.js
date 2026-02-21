/**
 * @file WCAG 2.1 Level AA Compliance Tests
 * @description Comprehensive accessibility testing for NiFi JWT Authenticator UI
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import {
    AccessibilityHelper,
    a11yUtils,
} from "../utils/accessibility-helper.js";
import { navigateToJWTAuthenticatorUI } from "../utils/navigation-utils.js";
import { testLogger } from "../utils/test-logger.js";

/**
 * Test configuration
 */
const A11Y_CONFIG = {
    // Known issues to skip (temporary)
    knownIssues: [],

    // Components to test
    components: {
        tabs: {
            selector: ".jwt-tabs-header",
            name: "Tab Navigation",
        },
        configForm: {
            selector: "#issuer-config",
            name: "Configuration Form",
        },
    },
};

// Accessibility tests for WCAG 2.1 Level AA compliance
// Prerequisites:
// - NiFi must be running
// - MultiIssuerJWTTokenAuthenticator must be on the canvas
test.describe("WCAG 2.1 Level AA Compliance", () => {
    let accessibilityHelper;
    let currentPage;

    test.beforeEach(async ({ page }, testInfo) => {
        try {
            // Store the page reference for use in tests
            currentPage = page;

            // Navigate to JWT Authenticator UI
            const customUIFrame = await navigateToJWTAuthenticatorUI(
                page,
                testInfo,
            );

            // Use the frame context for accessibility testing
            const frameContext = customUIFrame ? customUIFrame : page;

            // Initialize accessibility helper
            accessibilityHelper = new AccessibilityHelper(frameContext);
            await accessibilityHelper.initialize();

            // Wait for UI to be ready
            await a11yUtils.waitForA11yReady(frameContext);

            await takeStartScreenshot(page, testInfo);
        } catch (error) {
            // Accessibility tests must fail loudly when NiFi is not available
            // This ensures proper CI/CD validation and prevents silent failures
            throw new Error(
                `ACCESSIBILITY TEST FAILURE: ${error.message}\n\n` +
                    "Accessibility tests require a running NiFi instance with the JWT processor configured.\n" +
                    "This is a hard requirement for accessibility validation in CI/CD pipelines.\n\n" +
                    "To resolve:\n" +
                    "1. Ensure NiFi is running at https://localhost:9095/nifi\n" +
                    "2. Add MultiIssuerJWTTokenAuthenticator processor to the canvas\n" +
                    "3. Re-run the accessibility tests\n\n" +
                    "Original error: " +
                    error.message,
                { cause: error },
            );
        }
    });

    // Helper function to ensure we have a valid accessibility helper
    async function ensureValidAccessibilityHelper(testInfo) {
        try {
            // Try to use the existing helper
            if (accessibilityHelper && accessibilityHelper.page) {
                // Check if the page is still valid by trying a simple operation
                await accessibilityHelper.page.evaluate(() => true);
                return accessibilityHelper;
            }
        } catch (_error) {
            testLogger.warn(
                "A11y",
                "Existing accessibility helper is invalid, creating new one",
            );
        }

        // Re-acquire frame and create new helper
        if (currentPage) {
            const customUIFrame = await navigateToJWTAuthenticatorUI(
                currentPage,
                testInfo,
            );
            const frameContext = customUIFrame ? customUIFrame : currentPage;
            const newHelper = new AccessibilityHelper(frameContext);
            await newHelper.initialize();
            await a11yUtils.waitForA11yReady(frameContext);
            return newHelper;
        }

        throw new Error("No valid page reference available");
    }

    test("Full page WCAG compliance check", async ({
        page: _page,
    }, testInfo) => {
        await test.step("Run comprehensive WCAG check", async () => {
            const helper = await ensureValidAccessibilityHelper(testInfo);
            const results = await helper.runWCAGCheck();

            if (!results.passed) {
                // Log violations for debugging
                testLogger.warn("A11y", `WCAG Violations found: ${JSON.stringify(results.violations)}`);

                // Filter known issues
                const filteredViolations = a11yUtils.skipKnownA11yIssues(
                    results.violations,
                    A11Y_CONFIG.knownIssues,
                );

                // Format violations for better reporting
                const formatted =
                    a11yUtils.formatViolations(filteredViolations);

                // Fail test with detailed information
                expect(formatted).toHaveLength(0);
            }
        });
    });

    test("Component-level accessibility checks", async ({ page }, testInfo) => {
        // KNOWN ISSUE: Configuration Form has a pre-existing accessibility violation.
        // Previously silently swallowed via expect(true).toBe(true).
        // Now properly asserted — remove test.fail() when the issue is resolved.
        test.fail();

        // Get the custom UI frame once
        const customUIFrame = await navigateToJWTAuthenticatorUI(
            page,
            testInfo,
        );

        for (const [key, component] of Object.entries(A11Y_CONFIG.components)) {
            await test.step(`Check ${component.name} accessibility`, async () => {
                // For the tabs component, it should always be visible
                if (key === "tabs") {
                    const tabsExist =
                        (await customUIFrame
                            .locator(component.selector)
                            .count()) > 0;
                    expect(tabsExist).toBe(true);
                    return; // Skip detailed check for tabs
                }

                // For configForm, check if it's visible (default tab)
                if (key === "configForm") {
                    const configFormVisible = await customUIFrame
                        .locator(component.selector)
                        .isVisible();
                    expect(configFormVisible).toBe(true);

                    // Run accessibility check — let failures propagate
                    const helper =
                        await ensureValidAccessibilityHelper(testInfo);
                    const result = await helper.checkComponent(
                        component.selector,
                        component.name,
                    );

                    if (!result.passed) {
                        testLogger.warn(
                            "A11y",
                            `${component.name} issues: ${JSON.stringify(result, null, 2)}`,
                        );
                    }

                    expect(result.passed).toBe(true);
                }
            });
        }
    });

    test("Form field labeling and associations", async ({ page }, testInfo) => {
        await test.step("Check all form fields have proper labels", async () => {
            const helper = await ensureValidAccessibilityHelper(testInfo);
            const results = await helper.runCustomChecks();

            const formLabelIssues = results.failures.filter(
                (f) => f.check === "formLabels",
            );

            expect(formLabelIssues).toHaveLength(0);

            if (formLabelIssues.length > 0) {
                testLogger.warn("A11y", `Form label issues: ${JSON.stringify(formLabelIssues)}`);
            }
        });

        await test.step("Verify required field indicators", async () => {
            const customUIFrame = await navigateToJWTAuthenticatorUI(
                page,
                testInfo,
            );
            const requiredFields = await customUIFrame
                .locator("input[required], select[required]")
                .all();

            // If there are required fields, check them
            if (requiredFields.length > 0) {
                for (const field of requiredFields) {
                    const ariaRequired =
                        await field.getAttribute("aria-required");
                    const label = await field.evaluate((el) => {
                        const id = el.id;
                        const labelEl = document.querySelector(
                            `label[for="${id}"]`,
                        );
                        return labelEl ? labelEl.textContent : null;
                    });

                    expect(ariaRequired).toBe("true");
                    expect(label).toContain("*"); // Visual indicator
                }
            }

            // Also check that all form inputs have proper labels
            const allInputs = await customUIFrame
                .locator("input:not([type='hidden']), select, textarea")
                .all();

            for (const input of allInputs) {
                const hasLabel = await input.evaluate((el) => {
                    // Check for associated label
                    if (el.id) {
                        const label = document.querySelector(
                            `label[for="${el.id}"]`,
                        );
                        if (label) return true;
                    }
                    // Check for aria-label or aria-labelledby
                    return (
                        el.hasAttribute("aria-label") ||
                        el.hasAttribute("aria-labelledby")
                    );
                });

                expect(hasLabel).toBe(true);
            }
        });
    });

    test("Keyboard navigation and focus management", async ({
        page,
    }, testInfo) => {
        // Navigate once and reuse the frame across all steps
        const customUIFrame = await navigateToJWTAuthenticatorUI(
            page,
            testInfo,
        );

        await test.step("Test tab order through all interactive elements", async () => {
            // Get focusable elements within the frame
            const focusableElements = await customUIFrame
                .locator(
                    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                )
                .all();

            expect(focusableElements.length).toBeGreaterThan(0);
            testLogger.info(
                "A11y",
                `Total focusable elements: ${focusableElements.length}`,
            );

            // Focus the first element in the frame, then tab through
            if (focusableElements.length > 0) {
                await focusableElements[0].focus();
                for (
                    let i = 1;
                    i < Math.min(5, focusableElements.length);
                    i++
                ) {
                    await page.keyboard.press("Tab");
                    await page.waitForTimeout(100); // Small delay for focus to settle
                }
            }
        });

        await test.step("Verify focus indicators are visible", async () => {
            const interactiveElements = await customUIFrame
                .locator('button, a, input, select, textarea, [role="button"]')
                .all();

            for (const element of interactiveElements.slice(0, 5)) {
                // Test first 5
                await element.focus();

                const hasFocusIndicator = await element.evaluate((el) => {
                    const styles = window.getComputedStyle(el);
                    return (
                        styles.outline !== "none" ||
                        styles.boxShadow !== "none" ||
                        styles.border !== styles.borderColor
                    ); // Border change on focus
                });

                expect(hasFocusIndicator).toBe(true);
            }
        });

        await test.step("Test keyboard shortcuts", async () => {
            // Verify no modal dialogs are present within the custom UI frame
            const dialogVisible = await customUIFrame
                .locator(".ui-dialog, .modal, [role='dialog']")
                .isVisible()
                .catch(() => false);
            expect(dialogVisible).toBe(false);
        });
    });

    test("ARIA attributes and roles", async ({ page }, testInfo) => {
        await test.step("Validate ARIA attribute usage", async () => {
            const helper = await ensureValidAccessibilityHelper(testInfo);
            const results = await helper.runCustomChecks();

            const ariaIssues = results.failures.filter(
                (f) => f.check === "ariaAttributes",
            );

            expect(ariaIssues).toHaveLength(0);

            if (ariaIssues.length > 0) {
                testLogger.warn("A11y", `ARIA attribute issues: ${JSON.stringify(ariaIssues)}`);
            }
        });

        await test.step("Check landmark roles", async () => {
            const customUIFrame = await navigateToJWTAuthenticatorUI(
                page,
                testInfo,
            );
            const mainContent = await customUIFrame
                .locator('[role="main"], main')
                .count();
            const navigation = await customUIFrame
                .locator('[role="navigation"], nav, [role="tablist"]')
                .count();

            // The custom UI should have main content area
            expect(mainContent + navigation).toBeGreaterThan(0);
        });

        await test.step("Verify live regions for dynamic content", async () => {
            const helper = await ensureValidAccessibilityHelper(testInfo);
            const results = await helper.checkScreenReaderAnnouncements();

            expect(results.passed).toBe(true);
            expect(results.announcements.length).toBeGreaterThan(0);
        });
    });

    test("Color contrast and visual design", async ({ page }, testInfo) => {
        const customUIFrame = await navigateToJWTAuthenticatorUI(page, testInfo);

        await test.step("Check text color contrast", async () => {
            // Create a fresh helper from the current frame (not the beforeEach one which is detached)
            const frameContext = customUIFrame ? customUIFrame : page;
            const helper = new AccessibilityHelper(frameContext);
            await helper.initialize();
            await a11yUtils.waitForA11yReady(frameContext);
            const results = await helper.runCustomChecks();

            const contrastIssues = results.failures.filter(
                (f) => f.check === "colorContrast",
            );

            expect(contrastIssues).toHaveLength(0);
        });

        await test.step("Verify error and success states have sufficient contrast", async () => {
            // Trigger validation error within the custom UI frame
            const validateButton = customUIFrame
                .locator('button:has-text("Validate")')
                .first();
            if (await validateButton.isVisible()) {
                await validateButton.click();
                await page.waitForTimeout(500);

                const errorMessage = customUIFrame.locator(".validation-error").first();
                if (await errorMessage.isVisible()) {
                    const contrast = await errorMessage.evaluate((el) => {
                        const styles = window.getComputedStyle(el);
                        return {
                            color: styles.color,
                            background: styles.backgroundColor,
                        };
                    });

                    // Visual check - actual contrast calculation would be more complex
                    expect(contrast.color).not.toBe(contrast.background);
                }
            }
        });
    });

    test("Screen reader compatibility", async ({ page }, testInfo) => {
        // KNOWN ISSUE: Custom UI has heading level skip (e.g. h1 → h4).
        // Previously hidden because the test ran on `page` (NiFi chrome) instead of `customUIFrame`.
        // Now correctly detected — remove test.fail() when the heading hierarchy is fixed.
        test.fail();

        const customUIFrame = await navigateToJWTAuthenticatorUI(page, testInfo);

        await test.step("Check heading hierarchy", async () => {
            const headings = await customUIFrame.locator("h1, h2, h3, h4, h5, h6").all();
            const headingLevels = [];

            for (const heading of headings) {
                const level = await heading.evaluate((el) =>
                    parseInt(el.tagName[1]),
                );
                const text = await heading.textContent();
                headingLevels.push({ level, text });
            }

            // Verify logical heading hierarchy
            for (let i = 1; i < headingLevels.length; i++) {
                const diff =
                    headingLevels[i].level - headingLevels[i - 1].level;
                expect(diff).toBeLessThanOrEqual(1); // No skipping levels
            }
        });

        await test.step("Verify images have alt text", async () => {
            const images = await customUIFrame.locator("img").all();

            for (const img of images) {
                const alt = await img.getAttribute("alt");
                const isDecorative =
                    (await img.getAttribute("role")) === "presentation";

                if (!isDecorative) {
                    expect(alt).toBeTruthy();
                }
            }
        });

        await test.step("Check table accessibility", async () => {
            const tables = await customUIFrame.locator("table").all();

            for (const table of tables) {
                const _caption = await table.locator("caption").count();
                const headers = await table.locator("th").count();

                expect(headers).toBeGreaterThan(0); // Tables should have headers
            }
        });
    });

    test("Dynamic content accessibility", async ({ page }, testInfo) => {
        const customUIFrame = await navigateToJWTAuthenticatorUI(page, testInfo);

        await test.step("Verify loading states are announced", async () => {
            // Click validate button to trigger loading within the custom UI frame
            const validateButton = customUIFrame
                .locator('button:has-text("Test Connection")')
                .first();
            if (await validateButton.isVisible()) {
                await validateButton.click();

                // Check for loading announcement
                const loadingText = customUIFrame.locator(
                    '[aria-live="polite"]:has-text("Testing")',
                );
                await expect(loadingText).toBeVisible();
            }
        });

        await test.step("Check error announcements", async () => {
            // Trigger an error within the custom UI frame
            const tokenInput = customUIFrame.locator("#token-input");
            if (await tokenInput.isVisible()) {
                await tokenInput.fill("invalid-token");
                await customUIFrame.locator('button:has-text("Verify")').click();

                // Check for error announcement
                const errorRegion = customUIFrame.locator(
                    '[role="alert"], [aria-live="assertive"]',
                );
                await expect(errorRegion).toBeVisible();
            }
        });
    });

    test("Generate comprehensive accessibility report", async ({
        page: _page,
    }, testInfo) => {
        const helper = await ensureValidAccessibilityHelper(testInfo);
        const report = await helper.generateReport();

        // Log report summary
        testLogger.info("A11y", `Accessibility Report Summary: ${JSON.stringify({
            wcagCompliant: report.summary.wcagPassed,
            customChecksPassed: report.summary.customChecksPassed,
            keyboardAccessible: report.summary.keyboardNavigable,
            screenReaderReady: report.summary.screenReaderReady,
        })}`);

        // Save detailed report
        await test.step("Save accessibility report", async () => {
            testLogger.info("A11y", `Full Accessibility Report: ${JSON.stringify(report, null, 2)}`);
        });

        // Assert overall compliance
        expect(report.summary.wcagPassed).toBe(true);
        expect(report.summary.customChecksPassed).toBe(true);
        expect(report.summary.keyboardNavigable).toBe(true);
        expect(report.summary.screenReaderReady).toBe(true);
    });
});
