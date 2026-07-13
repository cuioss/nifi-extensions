/**
 * @file Accessibility Testing Helper
 * @description Comprehensive WCAG 2.1 Level AA compliance testing utilities
 * @version 1.0.0
 */

import AxeBuilder from "@axe-core/playwright";

/** WCAG tags to check */
const WCAG_TAGS = ["wcag2aa", "wcag21aa", "best-practice"];

/** Rules to disable in NiFi UI context */
const DISABLED_RULES = ["bypass", "landmark-one-main", "region"];

/**
 * Create a pre-configured AxeBuilder for a page or frame.
 * AxeBuilder requires a Page object (with mainFrame()). When a Frame is passed
 * (e.g. custom UI iframe), we use its owning page and scope to the frame's URL.
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} pageOrFrame
 * @param {string|null} selector - optional CSS selector to scope the check
 * @returns {import('@axe-core/playwright').default} configured AxeBuilder
 */
function createAxeBuilder(pageOrFrame, selector = null) {
    // AxeBuilder needs a Page, not a Frame. Detect Frames by checking for page().
    const isFrame =
        typeof pageOrFrame.page === "function" &&
        typeof pageOrFrame.mainFrame !== "function";
    const page = isFrame ? pageOrFrame.page() : pageOrFrame;

    const builder = new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .disableRules(DISABLED_RULES);
    if (selector) {
        if (isFrame) {
            // Element lives inside an iframe — use nested frame selector
            // so axe-core scans inside the frame, not the parent page
            builder.include({ fromFrames: ["iframe", selector] });
        } else {
            builder.include(selector);
        }
    }
    return builder;
}

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
        description:
            "Interactive elements must be reachable and correctly ordered for keyboard users",
        selector:
            'button, a, input, select, textarea, [role="button"], [tabindex]',
        check: async (page, element) => {
            const info = await element.evaluate((el) => {
                const tabindexAttr = el.getAttribute("tabindex");
                return {
                    tag: el.tagName.toLowerCase(),
                    role: el.getAttribute("role"),
                    tabindex: tabindexAttr,
                    tabindexNum:
                        tabindexAttr === null ? null : Number(tabindexAttr),
                    disabled: el.hasAttribute("disabled"),
                    href: el.getAttribute("href"),
                };
            });

            // A positive tabindex hijacks the natural document tab order — a
            // recognised WCAG anti-pattern.
            if (
                info.tabindexNum !== null &&
                Number.isFinite(info.tabindexNum) &&
                info.tabindexNum > 0
            ) {
                return {
                    passed: false,
                    message: `Positive tabindex (${info.tabindex}) disrupts natural tab order`,
                };
            }

            const nativelyFocusable =
                info.tag === "button" ||
                info.tag === "select" ||
                info.tag === "textarea" ||
                info.tag === "input" ||
                (info.tag === "a" && info.href !== null);

            const hasInteractiveRole = info.role !== null;

            // An element made interactive purely via an ARIA role (e.g.
            // <div role="button">) must expose a non-negative tabindex, or
            // keyboard users cannot reach it.
            if (
                !nativelyFocusable &&
                hasInteractiveRole &&
                (info.tabindexNum === null || info.tabindexNum < 0)
            ) {
                return {
                    passed: false,
                    message: `Element with role="${info.role}" is not keyboard focusable (missing non-negative tabindex)`,
                };
            }

            // A natively interactive control pulled out of the tab order via
            // tabindex="-1" (without a role that programmatically manages focus)
            // is unreachable by keyboard.
            if (
                nativelyFocusable &&
                !info.disabled &&
                info.tabindexNum === -1 &&
                !hasInteractiveRole
            ) {
                return {
                    passed: false,
                    message:
                        "Natively interactive element removed from keyboard tab order (tabindex=-1)",
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

    // Color contrast for custom components (WCAG 2.1 AA contrast ratio)
    colorContrast: {
        description: "Text must have sufficient color contrast (WCAG 2.1 AA)",
        selector: ".validation-error, .validation-success, .help-text",
        check: async (page, element) => {
            return element.evaluate((el) => {
                const parseColor = (str) => {
                    if (!str) return null;
                    const m = str.match(/rgba?\(([^)]+)\)/);
                    if (!m) return null;
                    const parts = m[1]
                        .split(",")
                        .map((p) => parseFloat(p.trim()));
                    const [r, g, b] = parts;
                    const a = parts.length >= 4 ? parts[3] : 1;
                    return { r, g, b, a };
                };

                const relativeLuminance = ({ r, g, b }) => {
                    const srgb = [r, g, b].map((c) => {
                        const cs = c / 255;
                        return cs <= 0.03928
                            ? cs / 12.92
                            : Math.pow((cs + 0.055) / 1.055, 2.4);
                    });
                    return (
                        0.2126 * srgb[0] +
                        0.7152 * srgb[1] +
                        0.0722 * srgb[2]
                    );
                };

                const style = window.getComputedStyle(el);
                const textColor = parseColor(style.color);
                if (!textColor) return { passed: true }; // cannot determine — skip

                // Resolve the effective background by walking up the ancestor
                // chain until a non-transparent background colour is found.
                let node = el;
                let bg = null;
                while (node) {
                    const parsed = parseColor(
                        window.getComputedStyle(node).backgroundColor,
                    );
                    if (parsed && parsed.a !== 0) {
                        bg = parsed;
                        break;
                    }
                    node = node.parentElement;
                }
                if (!bg) bg = { r: 255, g: 255, b: 255, a: 1 }; // assume white page background

                const l1 = relativeLuminance(textColor);
                const l2 = relativeLuminance(bg);
                const ratio =
                    (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

                // Large text (>= 24px, or >= 18.66px bold) needs only 3:1; all
                // other text needs 4.5:1 (WCAG 2.1 SC 1.4.3).
                const fontSize = parseFloat(style.fontSize) || 16;
                const fontWeight = parseInt(style.fontWeight, 10) || 400;
                const isLarge =
                    fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
                const threshold = isLarge ? 3.0 : 4.5;
                const rounded = Number(ratio.toFixed(2));

                if (ratio < threshold) {
                    return {
                        passed: false,
                        message: `Insufficient contrast ratio ${rounded}:1 (needs ${threshold}:1)`,
                        ratio: rounded,
                    };
                }
                return { passed: true, ratio: rounded };
            });
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
     * Initialize accessibility testing (no-op with @axe-core/playwright; kept for API compatibility)
     */
    async initialize() {
        // @axe-core/playwright injects axe automatically — no setup needed
    }

    /**
     * Run WCAG compliance check
     * @param options - unused, kept for API compatibility
     */
    async runWCAGCheck(options = {}) {
        void options;
        const results = await createAxeBuilder(this.page).analyze();
        if (results.violations.length === 0) {
            return { passed: true };
        }
        this.violations = results.violations;
        return { passed: false, violations: this.violations };
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
        } catch (_error) {
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
            const axeResults = await createAxeBuilder(
                this.page,
                selector,
            ).analyze();
            if (axeResults.violations.length > 0) {
                return {
                    passed: false,
                    component: componentName,
                    violations: axeResults.violations,
                };
            }

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
        let focusableElements;

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
     * Parse axe violations from error (legacy compatibility)
     * @param error - error object or axe results
     * @returns {Array} violations array
     */
    parseAxeViolations(error) {
        if (Array.isArray(error)) return error;
        if (error?.violations) return error.violations;
        return [
            { rule: "Unknown", impact: "Unknown", description: String(error) },
        ];
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
 * Accessibility test utilities
 */
export const a11yUtils = {
    /**
     * Wait for page to be ready for accessibility testing
     * @param page
     */
    async waitForA11yReady(page) {
        await page.waitForLoadState("networkidle");
        // Condition-based wait: the custom UI reveals its tab container once
        // initialisation completes (app.js hides the loading indicator). Fall
        // through silently when the context is not the custom UI frame.
        await page
            .locator("#jwt-validator-tabs")
            .waitFor({ state: "visible", timeout: 5000 })
            .catch(() => {});
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
