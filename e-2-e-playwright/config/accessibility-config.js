/**
 * @file Accessibility Testing Configuration
 * @description Configuration for WCAG 2.1 Level AA compliance testing
 */

/**
 * WCAG 2.1 Level AA compliance configuration
 */
export const WCAG_CONFIG = {
    // Axe-core rules configuration
    axeOptions: {
        runOnly: {
            type: "tag",
            values: ["wcag2aa", "wcag21aa", "best-practice"],
        },
        rules: {
            // Core WCAG rules (enabled by default)
            "color-contrast": { enabled: true },
            "keyboard-navigation": { enabled: true },
            "focus-indicator": { enabled: true },
            "aria-roles": { enabled: true },
            "form-field-labels": { enabled: true },

            // Disabled rules for NiFi UI context
            bypass: { enabled: false }, // Single-page app doesn't need skip links
            "landmark-one-main": { enabled: false }, // NiFi has custom layout structure
            region: { enabled: false }, // Complex UI with custom regions
            "page-has-heading-one": { enabled: false }, // UI is embedded in NiFi

            // Conditional rules
            "duplicate-id": { enabled: true }, // Critical for screen readers
            "link-name": { enabled: true }, // All links must have accessible names
            "button-name": { enabled: true }, // All buttons must have accessible names
            "image-alt": { enabled: true }, // Images must have alt text
            "heading-order": { enabled: true }, // Logical heading hierarchy
            "aria-valid-attr": { enabled: true }, // Valid ARIA attributes
            "aria-required-attr": { enabled: true }, // Required ARIA attributes
            tabindex: { enabled: true }, // Proper tabindex usage
        },
    },

    // Report configuration
    reportOptions: {
        detailedReport: true,
        detailedReportOptions: {
            html: true,
        },
    },
};

/**
 * Component-specific test configuration
 */
export const COMPONENT_CONFIG = {
    tabs: {
        selector: ".tab-navigation",
        name: "Tab Navigation",
        requirements: [
            "keyboard-navigation",
            "focus-indicators",
            "aria-labels",
        ],
    },

    configurationForm: {
        selector: ".configuration-tab",
        name: "Configuration Form",
        requirements: [
            "form-labels",
            "required-indicators",
            "error-messages",
            "field-validation",
        ],
    },

    jwksValidator: {
        selector: ".jwks-validation-content",
        name: "JWKS Validator",
        requirements: [
            "button-labels",
            "loading-indicators",
            "status-messages",
        ],
    },

    tokenVerifier: {
        selector: ".token-verification-tab",
        name: "Token Verifier",
        requirements: ["textarea-labels", "result-display", "error-handling"],
    },

    metricsDisplay: {
        selector: ".metrics-tab",
        name: "Metrics Display",
        requirements: ["table-headers", "data-labels", "chart-alternatives"],
    },

    helpContent: {
        selector: ".help-tab",
        name: "Help Content",
        requirements: ["heading-structure", "link-text", "content-structure"],
    },
};

/**
 * Accessibility test thresholds
 */
export const TEST_THRESHOLDS = {
    // Maximum allowed violations by impact level
    maxViolations: {
        critical: 0,
        serious: 0,
        moderate: 2, // Allow minor issues for initial implementation
        minor: 5,
    },

    // Performance thresholds
    maxTestDuration: 30000, // 30 seconds
    maxElementCheckTime: 5000, // 5 seconds per element

    // Coverage requirements
    minKeyboardElements: 5, // Minimum focusable elements
    minAriaElements: 3, // Minimum elements with ARIA attributes
    minHeadings: 2, // Minimum heading elements
};

/**
 * Known accessibility issues (temporary exceptions)
 * These should be addressed in future updates
 */
export const KNOWN_ISSUES = {
    // Temporary exceptions for existing UI
    skipRules: [
        // 'color-contrast' - uncomment if color issues need time to fix
    ],

    // Specific element exceptions
    skipElements: [
        // '[data-component="legacy-element"]' - example
    ],

    // Expected violations (with justification)
    expectedViolations: [
        // {
        //   rule: 'landmark-one-main',
        //   reason: 'NiFi UI is embedded within existing NiFi layout'
        // }
    ],
};

/**
 * Test execution configuration
 */
export const EXECUTION_CONFIG = {
    // Test execution modes
    modes: {
        quick: {
            components: ["configurationForm"], // Test only main form
            checks: ["wcag-basic"],
            timeout: 10000,
        },

        standard: {
            components: Object.keys(COMPONENT_CONFIG),
            checks: ["wcag-full", "custom-checks"],
            timeout: 30000,
        },

        comprehensive: {
            components: Object.keys(COMPONENT_CONFIG),
            checks: [
                "wcag-full",
                "custom-checks",
                "keyboard-nav",
                "screen-reader",
            ],
            timeout: 60000,
        },
    },

    // Default mode
    defaultMode: "standard",
};

/**
 * Reporting configuration
 */
export const REPORTING_CONFIG = {
    // Output formats
    formats: ["json", "html", "console"],

    // Report paths
    outputPath: "target/accessibility-reports",

    // Report naming
    filenameTemplate: "a11y-report-{timestamp}-{component}.{format}",

    // Report content
    includeScreenshots: true,
    includeRecommendations: true,
    includeTimestamps: true,

    // Aggregation
    generateSummary: true,
    combineReports: true,
};
