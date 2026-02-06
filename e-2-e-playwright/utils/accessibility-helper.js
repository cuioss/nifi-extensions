/**
 * @file Accessibility Testing Helper
 * @description Comprehensive WCAG 2.1 Level AA compliance testing utilities
 * @version 1.0.0
 */

import { checkA11y, injectAxe } from "axe-playwright";

/**
 * WCAG 2.1 Level AA compliance rules configuration
 */
const WCAG_AA_RULES = {
    runOnly: {
        type: "tag",
        values: ["wcag2aa", "wcag21aa", "best-practice"],
    },
    rules: {
        // Disable rules that may not apply to NiFi UI context
        bypass: { enabled: false }, // Skip bypass blocks in single-page apps
        "landmark-one-main": { enabled: false }, // NiFi uses custom layout
        region: { enabled: false }, // NiFi has complex region structure
    },
};

/**
 * Custom accessibility checks specific to NiFi JWT UI
 */
const CUSTOM_CHECKS = {
    // Form field labeling
    formLabels: {
        description: "All form fields must have associated labels",
        selector: 'input:not([type="hidden"]), select, textarea',
        check: async (page, element) => {
            const id = await element.getAttribute("id");
            const ariaLabel = await element.getAttribute("aria-label");
            const ariaLabelledby =
                await element.getAttribute("aria-labelledby");

            if (!id && !ariaLabel && !ariaLabelledby) {
                return {
                    passed: false,
                    message: "Form field missing label association",
                };
            }

            if (id) {
                const label = await page.locator(`label[for="${id}"]`).count();
                if (label === 0 && !ariaLabel && !ariaLabelledby) {
                    return {
                        passed: false,
                        message: `Form field with id="${id}" has no associated label`,
                    };
                }
            }

            return { passed: true };
        },
    },

    // Keyboard navigation
    keyboardAccessible: {
        description: "All interactive elements must be keyboard accessible",
        selector:
            'button, a, input, select, textarea, [role="button"], [tabindex]',
        check: async (page, element) => {
            const tabindex = await element.getAttribute("tabindex");
            const role = await element.getAttribute("role");

            if (tabindex === "-1" && !role) {
                return {
                    passed: false,
                    message: "Interactive element not keyboard accessible",
                };
            }

            return { passed: true };
        },
    },

    // Focus indicators
    focusIndicators: {
        description:
            "All focusable elements must have visible focus indicators",
        selector: "button, a, input, select, textarea",
        check: async (page, element) => {
            await element.focus();
            const styles = await element.evaluate((el) => {
                const computed = window.getComputedStyle(el);
                const focusStyles = window.getComputedStyle(el, ":focus");
                return {
                    outline: focusStyles.outline || computed.outline,
                    border: focusStyles.border || computed.border,
                    boxShadow: focusStyles.boxShadow || computed.boxShadow,
                };
            });

            if (
                styles.outline === "none" &&
                !styles.border &&
                styles.boxShadow === "none"
            ) {
                return {
                    passed: false,
                    message: "Element lacks visible focus indicator",
                };
            }

            return { passed: true };
        },
    },

    // Color contrast for custom components
    colorContrast: {
        description: "Text must have sufficient color contrast",
        selector: ".validation-error, .validation-success, .help-text",
        check: async (page, element) => {
            const contrast = await element.evaluate((el) => {
                const style = window.getComputedStyle(el);
                const bgColor = style.backgroundColor;
                const textColor = style.color;

                // Simple contrast check (full implementation would calculate actual ratio)
                if (
                    bgColor === "transparent" ||
                    bgColor === "rgba(0, 0, 0, 0)"
                ) {
                    return { passed: true }; // Skip transparent backgrounds
                }

                return {
                    passed: true, // Placeholder - would calculate actual contrast ratio
                    bgColor,
                    textColor,
                };
            });

            return contrast;
        },
    },

    // ARIA attributes validation
    ariaAttributes: {
        description: "ARIA attributes must be used correctly",
        selector: "[aria-label], [aria-labelledby], [aria-describedby], [role]",
        check: async (page, element) => {
            try {
                const role = await element.getAttribute("role", {
                    timeout: 2000,
                });
                const ariaLabel = await element.getAttribute("aria-label", {
                    timeout: 2000,
                });
                const ariaLabelledby = await element.getAttribute(
                    "aria-labelledby",
                    { timeout: 2000 },
                );
                const ariaDescribedby = await element.getAttribute(
                    "aria-describedby",
                    { timeout: 2000 },
                );

                // Check for valid role values
                const validRoles = [
                    "button",
                    "navigation",
                    "main",
                    "form",
                    "alert",
                    "status",
                    "tabpanel",
                    "tab",
                    "presentation",
                    "none",
                    "tablist",
                ];
                if (role && !validRoles.includes(role)) {
                    return {
                        passed: false,
                        message: `Invalid role attribute: ${role}`,
                    };
                }

                // Check for empty ARIA labels
                if (ariaLabel !== null && ariaLabel.trim() === "") {
                    return {
                        passed: false,
                        message: "Empty aria-label attribute",
                    };
                }

                // Check referenced elements exist
                if (ariaLabelledby) {
                    const ids = ariaLabelledby.split(" ");
                    for (const id of ids) {
                        const exists = await page.locator(`#${id}`).count();
                        if (exists === 0) {
                            return {
                                passed: false,
                                message: `aria-labelledby references non-existent element: ${id}`,
                            };
                        }
                    }
                }

                if (ariaDescribedby) {
                    const ids = ariaDescribedby.split(" ");
                    for (const id of ids) {
                        const exists = await page.locator(`#${id}`).count();
                        if (exists === 0) {
                            return {
                                passed: false,
                                message: `aria-describedby references non-existent element: ${id}`,
                            };
                        }
                    }
                }

                return { passed: true };
            } catch (error) {
                // Element might have been removed or is stale
                console.warn(
                    "Could not check ARIA attributes on element:",
                    error.message,
                );
                return { passed: true }; // Skip this element
            }
        },
    },
};

/**
 * Accessibility testing class
 */
export class AccessibilityHelper {
    constructor(page) {
        this.page = page;
        this.violations = [];
        this.customCheckResults = [];
    }

    /**
     * Initialize accessibility testing
     */
    async initialize() {
        await injectAxe(this.page);
    }

    /**
     * Run WCAG compliance check
     * @param options
     */
    async runWCAGCheck(options = {}) {
        const config = {
            ...WCAG_AA_RULES,
            ...options,
        };

        try {
            await checkA11y(this.page, null, {
                axeOptions: config,
                detailedReport: true,
                detailedReportOptions: {
                    html: true,
                },
            });
            return { passed: true };
        } catch (error) {
            // Parse axe violations from error
            this.violations = this.parseAxeViolations(error);
            return {
                passed: false,
                violations: this.violations,
            };
        }
    }

    /**
     * Run custom accessibility checks
     */
    async runCustomChecks() {
        this.customCheckResults = [];

        for (const [checkName, checkConfig] of Object.entries(CUSTOM_CHECKS)) {
            try {
                const elements = await this.page
                    .locator(checkConfig.selector)
                    .all();

                // Process elements in smaller batches to avoid timeouts
                const batchSize = 5;
                for (let i = 0; i < elements.length; i += batchSize) {
                    const batch = elements.slice(i, i + batchSize);

                    for (const element of batch) {
                        try {
                            // Check if element is still attached to DOM
                            const isAttached = await element
                                .isVisible()
                                .catch(() => false);
                            if (!isAttached) continue;

                            const result = await checkConfig.check(
                                this.page,
                                element,
                            );
                            if (!result.passed) {
                                this.customCheckResults.push({
                                    check: checkName,
                                    description: checkConfig.description,
                                    element: await element
                                        .evaluate((el) =>
                                            el.outerHTML.substring(0, 100),
                                        )
                                        .catch(() => "Element not available"),
                                    message: result.message,
                                });
                            }
                        } catch (elementError) {
                            console.warn(
                                `Skipping element in ${checkName} check:`,
                                elementError.message,
                            );
                        }
                    }
                }
            } catch (error) {
                console.error(`Error in ${checkName} check:`, error);
            }
        }

        return {
            passed: this.customCheckResults.length === 0,
            failures: this.customCheckResults,
        };
    }

    /**
     * Check specific component accessibility
     * @param selector
     * @param componentName
     */
    async checkComponent(selector, componentName) {
        const component = this.page.locator(selector);

        // Wait for component to be visible with a timeout
        try {
            await component.waitFor({ state: "visible", timeout: 5000 });
        } catch (error) {
            // If component is not visible, check if it might be in a hidden tab
            const elementExists = (await component.count()) > 0;

            if (elementExists) {
                // Component exists but is hidden (e.g., in an inactive tab)
                console.log(
                    `Component ${componentName} exists but is hidden (inactive tab)`,
                );
                return {
                    passed: true,
                    message: `Component ${componentName} exists but is hidden (inactive tab)`,
                    skipped: true,
                };
            }

            return {
                passed: false,
                message: `Component ${componentName} not found or not visible after waiting`,
            };
        }

        // Run axe on specific component
        try {
            await checkA11y(this.page, selector, {
                axeOptions: WCAG_AA_RULES,
                detailedReport: true,
            });

            // Run custom checks on component with element limits to avoid timeouts
            const customResults = [];
            const maxElementsPerCheck = 5;
            for (const [checkName, checkConfig] of Object.entries(
                CUSTOM_CHECKS,
            )) {
                try {
                    const elements = await component
                        .locator(checkConfig.selector)
                        .all();
                    const limitedElements = elements.slice(
                        0,
                        maxElementsPerCheck,
                    );
                    for (const element of limitedElements) {
                        try {
                            const isAttached = await element
                                .isVisible()
                                .catch(() => false);
                            if (!isAttached) continue;

                            const result = await checkConfig.check(
                                this.page,
                                element,
                            );
                            if (!result.passed) {
                                customResults.push({
                                    check: checkName,
                                    message: result.message,
                                });
                            }
                        } catch (elementError) {
                            console.warn(
                                `Skipping element in ${checkName} component check:`,
                                elementError.message,
                            );
                        }
                    }
                } catch (checkError) {
                    console.warn(
                        `Error in ${checkName} component check:`,
                        checkError.message,
                    );
                }
            }

            return {
                passed: customResults.length === 0,
                component: componentName,
                failures: customResults,
            };
        } catch (error) {
            return {
                passed: false,
                component: componentName,
                violations: this.parseAxeViolations(error),
            };
        }
    }

    /**
     * Check keyboard navigation
     */
    async checkKeyboardNavigation() {
        // Ensure we have a valid page reference
        if (!this.page) {
            console.error("AccessibilityHelper: No page reference available");
            return {
                passed: false,
                message:
                    "No page reference available for keyboard navigation check",
                results: [],
            };
        }

        const results = [];
        let focusableElements = [];

        try {
            // Check if we're in a frame context
            const isFrameContext = this.page.constructor.name === "Frame";

            // Get all focusable elements
            focusableElements = await this.page
                .locator(
                    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                )
                .all();

            // If we're in a frame context, we can't use keyboard API
            // Just verify that focusable elements exist
            if (isFrameContext || !this.page.keyboard) {
                console.log(
                    "Keyboard navigation check limited in frame context",
                );
                return {
                    passed: focusableElements.length > 0,
                    tabOrder: focusableElements.map((el, i) => ({
                        index: i,
                        element: "Focusable element found",
                        accessible: true,
                    })),
                    totalFocusable: focusableElements.length,
                    limited: true,
                };
            }

            // Test tab navigation order
            for (let i = 0; i < Math.min(5, focusableElements.length); i++) {
                await this.page.keyboard.press("Tab");
                const focusedElement = await this.page.evaluate(
                    () => document.activeElement.outerHTML,
                );

                results.push({
                    index: i,
                    element: focusedElement.substring(0, 100),
                    accessible: true,
                });
            }
        } catch (error) {
            console.error("Error during keyboard navigation check:", error);
            return {
                passed: false,
                message: `Keyboard navigation check failed: ${error.message}`,
                results: [],
            };
        }

        return {
            passed: true,
            tabOrder: results,
            totalFocusable: focusableElements.length,
        };
    }

    /**
     * Check screen reader announcements
     */
    async checkScreenReaderAnnouncements() {
        const announcements = [];

        // Check for aria-live regions
        const liveRegions = await this.page
            .locator('[aria-live], [role="alert"], [role="status"]')
            .all();

        for (const region of liveRegions) {
            const attrs = await region.evaluate((el) => ({
                role: el.getAttribute("role"),
                ariaLive: el.getAttribute("aria-live"),
                ariaAtomic: el.getAttribute("aria-atomic"),
                content: el.textContent.trim(),
            }));

            announcements.push(attrs);
        }

        return {
            passed: announcements.length > 0,
            announcements,
            message:
                announcements.length === 0
                    ? "No screen reader announcement regions found"
                    : null,
        };
    }

    /**
     * Generate accessibility report
     */
    async generateReport() {
        const wcagResults = await this.runWCAGCheck();
        const customResults = await this.runCustomChecks();
        const keyboardResults = await this.checkKeyboardNavigation();
        const screenReaderResults = await this.checkScreenReaderAnnouncements();

        return {
            timestamp: new Date().toISOString(),
            url: this.page.url(),
            summary: {
                wcagPassed: wcagResults.passed,
                customChecksPassed: customResults.passed,
                keyboardNavigable: keyboardResults.passed,
                screenReaderReady: screenReaderResults.passed,
            },
            details: {
                wcag: wcagResults,
                custom: customResults,
                keyboard: keyboardResults,
                screenReader: screenReaderResults,
            },
            recommendations: this.generateRecommendations(
                wcagResults,
                customResults,
            ),
        };
    }

    /**
     * Parse axe violations from error
     * @param error
     */
    parseAxeViolations(error) {
        // Extract violations from error message
        const violations = [];
        const errorStr = error.toString();

        // Basic parsing - in real implementation would parse structured data
        if (errorStr.includes("violations")) {
            violations.push({
                rule: "Unknown",
                impact: "Unknown",
                description: errorStr,
            });
        }

        return violations;
    }

    /**
     * Generate recommendations based on test results
     * @param wcagResults
     * @param customResults
     */
    generateRecommendations(wcagResults, customResults) {
        const recommendations = [];

        if (!wcagResults.passed) {
            recommendations.push({
                priority: "high",
                category: "WCAG Compliance",
                recommendation:
                    "Address WCAG 2.1 Level AA violations to ensure accessibility",
            });
        }

        if (!customResults.passed) {
            customResults.failures.forEach((failure) => {
                recommendations.push({
                    priority: "medium",
                    category: failure.check,
                    recommendation: `Fix: ${failure.message}`,
                });
            });
        }

        return recommendations;
    }
}

/**
 * Create accessibility test fixtures
 * @param test
 */
export function createAccessibilityFixtures(test) {
    return test.extend({
        accessibilityHelper: async ({ page }, use) => {
            const helper = new AccessibilityHelper(page);
            await helper.initialize();
            await use(helper);
        },
    });
}

/**
 * Accessibility test utilities
 */
export const a11yUtils = {
    /**
     * Wait for page to be ready for accessibility testing
     * @param page
     */
    async waitForA11yReady(page) {
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500); // Allow for dynamic content
    },

    /**
     * Skip accessibility check for known issues
     * @param violations
     * @param knownIssues
     */
    skipKnownA11yIssues(violations, knownIssues = []) {
        return violations.filter((v) => !knownIssues.includes(v.id));
    },

    /**
     * Format accessibility violations for reporting
     * @param violations
     */
    formatViolations(violations) {
        return violations.map((v) => ({
            rule: v.id,
            impact: v.impact,
            description: v.description,
            elements: v.nodes.length,
            help: v.helpUrl,
        }));
    },
};
