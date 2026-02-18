/**
 * @fileoverview Consolidated test fixtures for Playwright tests
 * Uses testLogger for per-test text log persistence and @axe-core/playwright for accessibility
 */

import { mkdirSync } from "fs";
import { test as authTest } from "./auth-fixtures.js";
import AxeBuilder from "@axe-core/playwright";
import { testLogger } from "../utils/test-logger.js";
import {
    setupErrorMonitoring,
    cleanupCriticalErrorDetection,
} from "../utils/critical-error-detector.js";
import { ProcessorApiManager } from "../utils/processor-api-manager.js";
import { join } from "path";

/**
 * Extended test with all fixtures combined including structured test logging
 */
export const test = authTest.extend({
    /**
     * Page fixture with automatic console logging and error monitoring
     */
    page: async ({ page }, use, testInfo) => {
        testLogger.startTest(testInfo.testId);
        testLogger.setupBrowserCapture(page);
        setupErrorMonitoring(page, testInfo);

        await use(page);

        // Automatic end-tests screenshot + text logs
        mkdirSync(testInfo.outputDir, { recursive: true });
        await page
            .screenshot({
                path: join(testInfo.outputDir, "after.png"),
                fullPage: true,
            })
            .catch(() => {});
        testLogger.writeLogs(testInfo);
        cleanupCriticalErrorDetection();
    },

    /**
     * Processor management fixture that provides ProcessorApiManager instance
     */
    processorManager: async ({ page }, use) => {
        const manager = new ProcessorApiManager(page);
        await use(manager);
    },

    /**
     * Accessibility testing fixture using @axe-core/playwright
     */
    accessibilityPage: async ({ page }, use) => {
        await use(page);
    },
});

/**
 * Accessibility-focused test with automatic checks
 */
export const accessibilityTest = test.extend({
    page: async ({ accessibilityPage }, use, _testInfo) => {
        await use(accessibilityPage);

        // Run accessibility check after each test
        await test.step("Accessibility check", async () => {
            try {
                const results = await new AxeBuilder({
                    page: accessibilityPage,
                })
                    .withTags(["wcag2aa", "wcag21aa", "best-practice"])
                    .disableRules(["bypass", "landmark-one-main", "region"])
                    .analyze();

                if (results.violations.length > 0) {
                    const summary = results.violations
                        .map(
                            (v) =>
                                `${v.id}: ${v.description} (${v.nodes.length} elements)`,
                        )
                        .join("\n");
                     
                    console.warn("Accessibility issues found:\n" + summary);
                }
            } catch (error) {
                 
                console.warn("Accessibility check failed:", error.message);
            }
        });
    },

    /**
     * Enhanced accessibility fixture with comprehensive testing
     */
    accessibilityHelper: async ({ page }, use) => {
        const { AccessibilityHelper } = await import(
            "../utils/accessibility-helper.js"
        );
        const helper = new AccessibilityHelper(page);
        await helper.initialize();
        await use(helper);
    },

    /**
     * Auto-setup fixture that ensures processor is on canvas
     * and navigates into the JWT Auth Pipeline process group.
     */
    withProcessorOnCanvas: async ({ page, processorManager }, use) => {
        const ready = await processorManager.ensureProcessorOnCanvas();

        if (!ready) {
            throw new Error(
                "PRECONDITION FAILED: Cannot ensure MultiIssuerJWTTokenAuthenticator is on canvas. " +
                    "The processor must be deployed in NiFi for tests to run.",
            );
        }

        testLogger.info("Processor", "All preconditions met");

        await use(page);
    },
});

/**
 * Extended test with gateway processor fixture
 */
export const gatewayTest = test.extend({
    /**
     * Auto-setup fixture that ensures the REST API Gateway processor is on canvas
     * and navigates into the REST API Gateway process group.
     */
    withGatewayProcessorOnCanvas: async ({ page, processorManager }, use) => {
        const ready = await processorManager.ensureGatewayProcessorOnCanvas();

        if (!ready) {
            throw new Error(
                "PRECONDITION FAILED: Cannot ensure RestApiGatewayProcessor is on canvas. " +
                    "The processor must be deployed in NiFi for tests to run.",
            );
        }

        testLogger.info("Processor", "Gateway preconditions met");

        await use(page);
    },
});

export { expect } from "@playwright/test";
export { takeStartScreenshot } from "../utils/test-logger.js";
