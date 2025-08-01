/**
 * @file WCAG 2.1 Level AA Compliance Tests
 * @description Comprehensive accessibility testing for NiFi JWT Authenticator UI
 */

import { test, expect } from "../fixtures/test-fixtures.js";
import {
    AccessibilityHelper,
    a11yUtils,
} from "../utils/accessibility-helper.js";
import { navigateToJWTAuthenticatorUI } from "../utils/navigation-utils.js";

/**
 * Test configuration
 */
const A11Y_CONFIG = {
    // Known issues to skip (temporary)
    knownIssues: [],

    // Components to test
    components: {
        tabs: {
            selector: ".tab-navigation",
            name: "Tab Navigation",
        },
        configForm: {
            selector: ".configuration-tab",
            name: "Configuration Form",
        },
        jwksValidator: {
            selector: ".jwks-validation-content",
            name: "JWKS Validator",
        },
        tokenVerifier: {
            selector: ".token-verification-tab",
            name: "Token Verifier",
        },
        metricsDisplay: {
            selector: ".metrics-tab",
            name: "Metrics Display",
        },
        helpContent: {
            selector: ".help-tab",
            name: "Help Content",
        },
    },
};

test.describe("WCAG 2.1 Level AA Compliance", () => {
    let accessibilityHelper;

    test.beforeEach(async ({ page }, testInfo) => {
        try {
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
        } catch (error) {
            // Accessibility tests must fail loudly when NiFi is not available
            // This ensures proper CI/CD validation and prevents silent failures
            throw new Error(
                `🚨 ACCESSIBILITY TEST FAILURE: ${error.message}\n\n` +
                    "Accessibility tests require a running NiFi instance with the JWT processor configured.\n" +
                    "This is a hard requirement for accessibility validation in CI/CD pipelines.\n\n" +
                    "To resolve:\n" +
                    "1. Ensure NiFi is running at https://localhost:9095/nifi\n" +
                    "2. Add MultiIssuerJWTTokenAuthenticator processor to the canvas\n" +
                    "3. Re-run the accessibility tests\n\n" +
                    "Original error: " +
                    error.message,
            );
        }
    });

    test("Full page WCAG compliance check", async ({ page: _page }) => {
        await test.step("Run comprehensive WCAG check", async () => {
            const results = await accessibilityHelper.runWCAGCheck();

            if (!results.passed) {
                // Log violations for debugging
                console.log("WCAG Violations found:", results.violations);

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

    test("Component-level accessibility checks", async ({ page }) => {
        for (const [key, component] of Object.entries(A11Y_CONFIG.components)) {
            await test.step(`Check ${component.name} accessibility`, async () => {
                // Navigate to component if needed
                if (key !== "configForm") {
                    const tabName = key
                        .replace(/([A-Z])/g, " $1")
                        .trim()
                        .toLowerCase();
                    const tab = page.locator(
                        `.tab-link:has-text("${tabName}")`,
                    );
                    if (await tab.isVisible()) {
                        await tab.click();
                        await page.waitForTimeout(300);
                    }
                }

                const result = await accessibilityHelper.checkComponent(
                    component.selector,
                    component.name,
                );

                expect(result.passed).toBe(true);

                if (!result.passed) {
                    console.log(
                        `${component.name} accessibility issues:`,
                        result,
                    );
                }
            });
        }
    });

    test("Form field labeling and associations", async ({ page }) => {
        await test.step("Check all form fields have proper labels", async () => {
            const results = await accessibilityHelper.runCustomChecks();

            const formLabelIssues = results.failures.filter(
                (f) => f.check === "formLabels",
            );

            expect(formLabelIssues).toHaveLength(0);

            if (formLabelIssues.length > 0) {
                console.log("Form label issues:", formLabelIssues);
            }
        });

        await test.step("Verify required field indicators", async () => {
            const requiredFields = await page
                .locator("input[required], select[required]")
                .all();

            for (const field of requiredFields) {
                const ariaRequired = await field.getAttribute("aria-required");
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
        });
    });

    test("Keyboard navigation and focus management", async ({ page }) => {
        await test.step("Test tab order through all interactive elements", async () => {
            const results = await accessibilityHelper.checkKeyboardNavigation();

            expect(results.passed).toBe(true);
            expect(results.totalFocusable).toBeGreaterThan(0);

            console.log(`Total focusable elements: ${results.totalFocusable}`);
        });

        await test.step("Verify focus indicators are visible", async () => {
            const interactiveElements = await page
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
            // Test Escape key closes dialogs
            await page.keyboard.press("Escape");

            // Verify dialog is closed (if applicable)
            const dialogVisible = await page.locator(".ui-dialog").isVisible();
            expect(dialogVisible).toBe(false);
        });
    });

    test("ARIA attributes and roles", async ({ page }) => {
        await test.step("Validate ARIA attribute usage", async () => {
            const results = await accessibilityHelper.runCustomChecks();

            const ariaIssues = results.failures.filter(
                (f) => f.check === "ariaAttributes",
            );

            expect(ariaIssues).toHaveLength(0);

            if (ariaIssues.length > 0) {
                console.log("ARIA attribute issues:", ariaIssues);
            }
        });

        await test.step("Check landmark roles", async () => {
            const mainContent = await page
                .locator('[role="main"], main')
                .count();
            const navigation = await page
                .locator('[role="navigation"], nav')
                .count();

            expect(mainContent).toBeGreaterThan(0);
            expect(navigation).toBeGreaterThan(0);
        });

        await test.step("Verify live regions for dynamic content", async () => {
            const results =
                await accessibilityHelper.checkScreenReaderAnnouncements();

            expect(results.passed).toBe(true);
            expect(results.announcements.length).toBeGreaterThan(0);
        });
    });

    test("Color contrast and visual design", async ({ page }) => {
        await test.step("Check text color contrast", async () => {
            const results = await accessibilityHelper.runCustomChecks();

            const contrastIssues = results.failures.filter(
                (f) => f.check === "colorContrast",
            );

            expect(contrastIssues).toHaveLength(0);
        });

        await test.step("Verify error and success states have sufficient contrast", async () => {
            // Trigger validation error
            const validateButton = page
                .locator('button:has-text("Validate")')
                .first();
            if (await validateButton.isVisible()) {
                await validateButton.click();
                await page.waitForTimeout(500);

                const errorMessage = page.locator(".validation-error").first();
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

    test("Screen reader compatibility", async ({ page }) => {
        await test.step("Check heading hierarchy", async () => {
            const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();
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
            const images = await page.locator("img").all();

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
            const tables = await page.locator("table").all();

            for (const table of tables) {
                const _caption = await table.locator("caption").count();
                const headers = await table.locator("th").count();

                expect(headers).toBeGreaterThan(0); // Tables should have headers
            }
        });
    });

    test("Dynamic content accessibility", async ({ page }) => {
        await test.step("Verify loading states are announced", async () => {
            // Click validate button to trigger loading
            const validateButton = page
                .locator('button:has-text("Test Connection")')
                .first();
            if (await validateButton.isVisible()) {
                await validateButton.click();

                // Check for loading announcement
                const loadingText = page.locator(
                    '[aria-live="polite"]:has-text("Testing")',
                );
                await expect(loadingText).toBeVisible();
            }
        });

        await test.step("Check error announcements", async () => {
            // Trigger an error
            const tokenInput = page.locator("#token-input");
            if (await tokenInput.isVisible()) {
                await tokenInput.fill("invalid-token");
                await page.locator('button:has-text("Verify")').click();

                // Check for error announcement
                const errorRegion = page.locator(
                    '[role="alert"], [aria-live="assertive"]',
                );
                await expect(errorRegion).toBeVisible();
            }
        });
    });

    test("Generate comprehensive accessibility report", async ({ page }) => {
        const report = await accessibilityHelper.generateReport();

        // Log report summary
        console.log("Accessibility Report Summary:", {
            wcagCompliant: report.summary.wcagPassed,
            customChecksPassed: report.summary.customChecksPassed,
            keyboardAccessible: report.summary.keyboardNavigable,
            screenReaderReady: report.summary.screenReaderReady,
        });

        // Save detailed report
        await test.step("Save accessibility report", async () => {
            const _reportPath = `target/accessibility-report-${Date.now()}.json`;
            await page.evaluate((reportData) => {
                console.log(
                    "Full Accessibility Report:",
                    JSON.stringify(reportData, null, 2),
                );
            }, report);
        });

        // Assert overall compliance
        expect(report.summary.wcagPassed).toBe(true);
        expect(report.summary.customChecksPassed).toBe(true);
        expect(report.summary.keyboardNavigable).toBe(true);
        expect(report.summary.screenReaderReady).toBe(true);
    });
});
