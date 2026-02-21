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
import { ProcessorService } from "../utils/processor.js";
import { PROCESSOR_TYPES } from "../utils/constants.js";
import { join, dirname } from "path";

const __fixturesDir = dirname(new URL(import.meta.url).pathname);
const AUTH_STATE_PATH = join(__fixturesDir, "..", ".auth", "state.json");

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
        testLogger.info("Test", `Started: ${testInfo.title}`);

        await use(page);

        testLogger.info("Test", `Finished: ${testInfo.status}`);
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

/**
 * Validate a cached frame is still usable; re-navigate if not.
 * @param {object} state - Mutable state with frame, page, and navigation deps
 * @param {Function} navigateFn - Async function that re-navigates and returns a frame
 * @returns {Promise<Frame>} The valid frame
 */
async function ensureValidFrame(state, navigateFn) {
    try {
        if (
            state.frame &&
            !state.frame.isDetached() &&
            state.page.url().includes("/advanced")
        ) {
            return state.frame;
        }
    } catch {
        /* frame reference invalid */
    }
    state.frame = await navigateFn();
    return state.frame;
}

/** Browser context options matching playwright.config.cjs */
const SHARED_CONTEXT_OPTIONS = {
    storageState: AUTH_STATE_PATH,
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    timezoneId: "America/New_York",
    permissions: ["clipboard-read", "clipboard-write"],
};

/**
 * Serial test fixture for JWT authenticator functional tests.
 * Shares a single browser page and Advanced UI across all tests in a file,
 * eliminating per-test auth + navigation overhead (~5-6s per test).
 *
 * Usage: import { serialTest as test } from '../fixtures/test-fixtures.js'
 */
export const serialTest = test.extend({
    /** Worker-scoped shared page with pre-loaded storageState */
    _sharedPage: [
        async ({ browser }, use) => {
            const context =
                await browser.newContext(SHARED_CONTEXT_OPTIONS);
            const page = await context.newPage();
            await use(page);
            await context.close();
        },
        { scope: "worker" },
    ],

    /** Override page to delegate to shared page with per-test monitoring */
    page: async ({ _sharedPage }, use, testInfo) => {
        testLogger.startTest(testInfo.testId);
        testLogger.setupBrowserCapture(_sharedPage);
        setupErrorMonitoring(_sharedPage, testInfo);
        testLogger.info("Test", `Started: ${testInfo.title}`);
        testLogger.info("Test", `URL: ${_sharedPage.url()}`);

        await use(_sharedPage);

        testLogger.info("Test", `Finished: ${testInfo.status}`);
        mkdirSync(testInfo.outputDir, { recursive: true });
        await _sharedPage
            .screenshot({
                path: join(testInfo.outputDir, "after.png"),
                fullPage: true,
            })
            .catch(() => {});
        testLogger.writeLogs(testInfo);
        cleanupCriticalErrorDetection();
    },

    /** Worker-scoped: navigates to JWT Advanced UI once, reused across tests */
    _jwtUIState: [
        async ({ _sharedPage }, use) => {
            await _sharedPage.goto("/nifi");
            await _sharedPage.waitForLoadState("domcontentloaded");

            const processorManager = new ProcessorApiManager(_sharedPage);
            await processorManager.ensureProcessorOnCanvas();
            const processorService = new ProcessorService(_sharedPage);
            const frame =
                await processorService.navigateToAdvancedUI();
            await use({
                frame,
                processorService,
                page: _sharedPage,
                processorManager,
            });
        },
        { scope: "worker" },
    ],

    /** Test-scoped: validates cached frame, re-navigates if detached */
    customUIFrame: async ({ _jwtUIState }, use) => {
        const frame = await ensureValidFrame(_jwtUIState, async () => {
            testLogger.info("Frame", "Re-navigating to Advanced UI (frame detached)");
            const { page, processorManager, processorService } =
                _jwtUIState;
            await page.goto("/nifi");
            await page.waitForLoadState("domcontentloaded");
            await processorManager.ensureProcessorOnCanvas();
            return processorService.navigateToAdvancedUI();
        });
        testLogger.info("Frame", `Custom UI frame ready (url: ${frame.url()})`);
        await use(frame);
    },

    /** Convenience fixture: ProcessorService bound to the shared page */
    processorService: async ({ page }, use, testInfo) => {
        await use(new ProcessorService(page, testInfo));
    },
});

/**
 * Serial test fixture for REST API Gateway functional tests.
 * Same shared-page pattern as serialTest but navigates to the gateway processor.
 *
 * Usage: import { serialGatewayTest as test } from '../fixtures/test-fixtures.js'
 */
export const serialGatewayTest = test.extend({
    _sharedPage: [
        async ({ browser }, use) => {
            const context =
                await browser.newContext(SHARED_CONTEXT_OPTIONS);
            const page = await context.newPage();
            await use(page);
            await context.close();
        },
        { scope: "worker" },
    ],

    page: async ({ _sharedPage }, use, testInfo) => {
        testLogger.startTest(testInfo.testId);
        testLogger.setupBrowserCapture(_sharedPage);
        setupErrorMonitoring(_sharedPage, testInfo);
        testLogger.info("Test", `Started: ${testInfo.title}`);
        testLogger.info("Test", `URL: ${_sharedPage.url()}`);

        await use(_sharedPage);

        testLogger.info("Test", `Finished: ${testInfo.status}`);
        mkdirSync(testInfo.outputDir, { recursive: true });
        await _sharedPage
            .screenshot({
                path: join(testInfo.outputDir, "after.png"),
                fullPage: true,
            })
            .catch(() => {});
        testLogger.writeLogs(testInfo);
        cleanupCriticalErrorDetection();
    },

    _gatewayUIState: [
        async ({ _sharedPage }, use) => {
            await _sharedPage.goto("/nifi");
            await _sharedPage.waitForLoadState("domcontentloaded");

            const processorManager = new ProcessorApiManager(_sharedPage);
            await processorManager.ensureGatewayProcessorOnCanvas();
            const processorService = new ProcessorService(_sharedPage);
            const processor = await processorService.find(
                PROCESSOR_TYPES.REST_API_GATEWAY,
                { failIfNotFound: true },
            );
            await processorService.openAdvancedUI(processor);
            const frame =
                await processorService.getAdvancedUIFrame();
            if (!frame) {
                throw new Error(
                    "Failed to get gateway custom UI frame",
                );
            }
            await use({
                frame,
                processorService,
                page: _sharedPage,
                processorManager,
            });
        },
        { scope: "worker" },
    ],

    customUIFrame: async ({ _gatewayUIState }, use) => {
        const frame = await ensureValidFrame(
            _gatewayUIState,
            async () => {
                testLogger.info("Frame", "Re-navigating to Gateway UI (frame detached)");
                const { page, processorManager, processorService } =
                    _gatewayUIState;
                await page.goto("/nifi");
                await page.waitForLoadState("domcontentloaded");
                await processorManager.ensureGatewayProcessorOnCanvas();
                const processor = await processorService.find(
                    PROCESSOR_TYPES.REST_API_GATEWAY,
                    { failIfNotFound: true },
                );
                await processorService.openAdvancedUI(processor);
                const newFrame =
                    await processorService.getAdvancedUIFrame();
                if (!newFrame) {
                    throw new Error(
                        "Failed to get gateway custom UI frame on re-navigation",
                    );
                }
                return newFrame;
            },
        );
        testLogger.info("Frame", `Gateway UI frame ready (url: ${frame.url()})`);
        await use(frame);
    },

    processorService: async ({ page }, use, testInfo) => {
        await use(new ProcessorService(page, testInfo));
    },
});

export { expect } from "@playwright/test";
export { takeStartScreenshot } from "../utils/test-logger.js";
