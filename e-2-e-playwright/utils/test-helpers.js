/**
 * @file Test helpers for E2E tests
 * Common helper functions for E2E tests
 * @version 1.0.0
 */

import { processorLogger } from "./shared-logger.js";

/**
 * Navigate to the Advanced UI and return the iframe context
 * @param {Page} page - Playwright page object
 * @param {ProcessorService} processorService - ProcessorService instance
 * @returns {Promise<Frame>} The custom UI frame
 */
export async function navigateToAdvancedUI(page, processorService) {
    // Find the MultiIssuerJWTTokenAuthenticator processor on canvas
    const processor = await processorService.findProcessorByType(
        "MultiIssuerJWTTokenAuthenticator",
    );

    if (!processor) {
        throw new Error(
            "MultiIssuerJWTTokenAuthenticator processor not found on canvas. Please add it manually.",
        );
    }

    // Open Advanced UI via right-click menu
    const advancedOpened = await processorService.openAdvancedUI(processor);

    if (!advancedOpened) {
        throw new Error("Failed to open Advanced UI via right-click menu");
    }

    // Wait for custom UI to load
    await page.waitForTimeout(2000);

    // Get the custom UI frame
    const customUIFrame = await processorService.getAdvancedUIFrame();

    if (!customUIFrame) {
        throw new Error("Could not find custom UI iframe");
    }

    processorLogger.info("Successfully accessed custom UI iframe");
    return customUIFrame;
}

/**
 * Click a tab in the custom UI
 * @param {Frame} customUIFrame - The custom UI iframe
 * @param {string} tabName - Name of the tab to click
 */
export async function clickTab(customUIFrame, tabName) {
    const tab = customUIFrame.locator(`[role="tab"]:has-text("${tabName}")`);
    await tab.click();
    await customUIFrame.page().waitForTimeout(1000);
    processorLogger.info(`Clicked ${tabName} tab`);
}